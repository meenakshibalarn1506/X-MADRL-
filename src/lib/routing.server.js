// Risk-aware routing engine (server-side, pure computation).
//
// The road network is a graph of segments. Every candidate route is scored with
// an additive cost function, so the factor contributions returned here and shown
// in the Explainable AI panel are an exact decomposition of the score that
// ranked the route — not an approximation and not a model attribution.
//
//   edge cost = base * (1 + risk)
//   base      = w_time * hours + w_distance * km          (the generalised cost)
//   risk      = Σ w_f * t_f  over hazard, closure, flood, damage, traffic, uncertainty
//
// Because cost = base + Σ (base * w_f * t_f), every factor's contribution sums
// exactly to the route cost.

import { DEFAULT_WEIGHTS, FACTORS, FRESHNESS, MODE_BY_KEY } from "@/lib/risk";
import { haversineKm } from "@/lib/geo";
import { ageHours, num } from "@/lib/net.server";
import { osrmRoute, hazardsNearRoute, routeRiskScore } from "@/lib/osrm.server";

const TRAFFIC_PENALTY = { low: 0, moderate: 0.35, severe: 0.8, unknown: 0.15 };
const DAMAGE_PENALTY = { none: 0, minor: 0.3, major: 0.8, unknown: 0.25 };
const SEVERITY_WEIGHT = { low: 0.25, caution: 0.5, elevated: 0.75, severe: 1 };
const RISK_KEYS = ["hazard", "closure", "flood", "damage", "traffic", "uncertainty"];

export const ENGINE_VERSION = "xmadrl-risk-engine-1.0";

function normName(s) {
  return String(s ?? "").trim().toLowerCase();
}

function cap01(n) {
  return Math.max(0, Math.min(1, n));
}

function hazardTermForSegment(segmentId, hazards, nowMs) {
  let weight = 0;
  const matched = [];
  for (const h of hazards) {
    const ids = h.affected_segment_ids ?? [];
    if (!ids.includes(segmentId)) continue;
    const age = ageHours(h.last_update ?? h.updated_date, nowMs);
    const decay = age == null ? 0.6 : Math.max(0.35, Math.exp(-age / 72));
    const confidence = typeof h.confidence === "number" ? h.confidence : 0.6;
    const contribution = (SEVERITY_WEIGHT[h.severity] ?? 0.5) * Math.abs(decay) * confidence;
    if (contribution > weight) weight = contribution;
    matched.push(h);
  }
  return { weight: cap01(weight), matched };
}

/**
 * Build the routing graph for one travel mode and preference set.
 * Confirmed, fresh, confident closures are removed from the graph entirely:
 * they are a routing constraint, not a penalty. Everything else is a penalty
 * plus a stated reason.
 */
export function buildGraph({ segments, hazards, mode, preferences, nowMs = Date.now() }) {
  const nodes = new Map();
  const edges = [];
  const hardClosed = [];
  const softClosures = [];
  const rejected = [];

  for (const s of segments) {
    const a = normName(s.from_name);
    const b = normName(s.to_name);
    const fromLat = num(s.from_lat);
    const fromLng = num(s.from_lng);
    const toLat = num(s.to_lat);
    const toLng = num(s.to_lng);
    if (!a || !b || a === b || fromLat == null || toLat == null) {
      rejected.push({ segment: s, reason: "incomplete geometry" });
      continue;
    }

    const confidence = num(s.data_confidence, 0.6);
    const age = ageHours(s.last_verified ?? s.updated_date, nowMs);
    const closureFresh = age != null && age <= FRESHNESS.confirmedClosureMaxAgeHours;
    const closureTrusted = closureFresh && confidence >= FRESHNESS.minConfidenceForHardConstraint;

    if (s.closure_status === "closed_confirmed" && closureTrusted) {
      hardClosed.push({
        segment_id: s.segment_id,
        road_name: s.road_name,
        from_name: s.from_name,
        to_name: s.to_name,
        source: s.source,
        last_verified: s.last_verified,
        confidence,
      });
      continue;
    }

    if (!nodes.has(a)) nodes.set(a, { key: a, label: s.from_name, lat: fromLat, lng: fromLng });
    if (!nodes.has(b)) nodes.set(b, { key: b, label: s.to_name, lat: toLat, lng: toLng });

    const straightKm = haversineKm({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
    const distanceKm = num(s.distance_km, null) ?? Math.max(1, straightKm * 1.22);

    const baseSpeed = MODE_BY_KEY[mode]?.baseSpeedKmh ?? 38;
    const segmentSpeed = num(s.speed_kmh, 40);
    const speed = mode === "driving" ? Math.min(segmentSpeed, 90) : baseSpeed;
    const timeMin = (distanceKm / Math.max(2, speed)) * 60;

    const hazard = hazardTermForSegment(s.segment_id, hazards, nowMs);

    let closureTerm = 0;
    if (s.closure_status === "closed_confirmed" && !closureTrusted) {
      closureTerm = 0.9;
      softClosures.push({
        segment_id: s.segment_id,
        road_name: s.road_name,
        reason: closureFresh
          ? "confirmed closure below the confidence threshold for a hard constraint"
          : "confirmed closure evidence is older than 6 h, so it is treated as a penalty",
        confidence,
        age_hours: age,
        source: s.source,
        last_verified: s.last_verified,
      });
    } else if (s.closure_status === "restricted") {
      closureTerm = 0.5;
      softClosures.push({
        segment_id: s.segment_id,
        road_name: s.road_name,
        reason: "restricted access — passable but constrained",
        confidence,
        age_hours: age,
        source: s.source,
        last_verified: s.last_verified,
      });
    } else if (s.closure_status === "unknown") {
      closureTerm = 0.2;
    }

    let damageTerm = DAMAGE_PENALTY[s.surface_damage] ?? 0.25;
    if (mode === "walking" && s.footpath === "no") damageTerm = cap01(damageTerm + 0.2);
    if (mode === "walking" && s.pedestrian_allowed === "no") damageTerm = cap01(damageTerm + 0.35);

    let uncertaintyTerm = 1 - confidence;
    if (age == null) uncertaintyTerm += 0.15;
    else if (age > FRESHNESS.ageingHours) uncertaintyTerm += 0.3;
    else if (age > FRESHNESS.freshHours) uncertaintyTerm += 0.15;

    edges.push({
      id: s.segment_id ?? s.id,
      a,
      b,
      aLabel: s.from_name,
      bLabel: s.to_name,
      distanceKm,
      timeMin,
      road_name: s.road_name,
      road_class: s.road_class,
      district: s.district,
      segment: s,
      matchedHazards: hazard.matched,
      terms: {
        hazard: hazard.weight,
        closure: cap01(closureTerm),
        flood: cap01(num(s.flood_exposure, 0)),
        damage: cap01(damageTerm),
        traffic: TRAFFIC_PENALTY[s.traffic_level] ?? 0.15,
        uncertainty: cap01(uncertaintyTerm),
      },
    });
  }

  // Normalise travel time across the network so the time factor is comparable.
  const maxTime = edges.reduce((m, e) => Math.max(m, e.timeMin), 1);
  const adjacency = new Map();
  for (const e of edges) {
    for (const [from, to] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ ...e, to });
    }
  }

  return { nodes, edges, adjacency, hardClosed, softClosures, rejected, maxTime, preferences };
}

function nearestNode(graph, point) {
  let best = null;
  for (const node of graph.nodes.values()) {
    const d = haversineKm(point, node);
    if (!best || d < best.distanceKm) best = { node, distanceKm: d };
  }
  return best;
}

export function edgeCosts(edge, weights, scenario) {
  if (scenario === "shortest") return { cost: edge.distanceKm, base: edge.distanceKm, risk: 0, contrib: {} };
  if (scenario === "fastest") return { cost: edge.timeMin, base: edge.timeMin, risk: 0, contrib: {} };

  const base = weights.time * (edge.timeMin / 60) + weights.distance * edge.distanceKm;
  let risk = 0;
  const contrib = {};
  for (const k of RISK_KEYS) {
    const c = (weights[k] ?? 0) * edge.terms[k];
    contrib[k] = c;
    risk += c;
  }
  return { cost: base * (1 + risk), base, risk, contrib };
}

function dijkstra(graph, startKey, goalKey, weights, scenario, penalties) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  dist.set(startKey, 0);

  while (visited.size < graph.nodes.size) {
    let current = null;
    let best = Number.POSITIVE_INFINITY;
    for (const [key, d] of dist) {
      if (!visited.has(key) && d < best) {
        best = d;
        current = key;
      }
    }
    if (current == null) break;
    if (current === goalKey) break;
    visited.add(current);

    for (const edge of graph.adjacency.get(current) ?? []) {
      const { cost } = edgeCosts(edge, weights, scenario);
      const penaltyFactor = penalties?.get(edge.id) ? 1.8 : 1;
      const next = best + cost * penaltyFactor;
      if (next < (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, next);
        prev.set(edge.to, { edge, from: current });
      }
    }
  }

  if (!dist.has(goalKey)) return null;
  const path = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    const step = prev.get(cursor);
    if (!step) return null;
    path.unshift(step.edge);
    cursor = step.from;
  }
  return { edges: path, cost: dist.get(goalKey) };
}

function signature(path) {
  return path.map((e) => `${e.a}|${e.b}|${e.road_name ?? ""}`).sort().join(">>");
}

function summariseRoute({ key, label, path, graph, weights, nowMs, originLabel, destLabel }) {
  const points = [];
  const steps = [];
  let distanceKm = 0;
  let timeMin = 0;
  let trafficAdjustedMin = 0;
  let baseSum = 0;
  let riskWeightedSum = 0;
  const contribSum = Object.fromEntries(FACTORS.map((f) => [f.key, 0]));
  const hazardsOnRoute = new Map();
  const closures = [];
  const disasterTraffic = [];
  const ordinaryTraffic = [];
  const confidenceValues = [];
  const unknownFlags = { traffic: 0, damage: 0, closure: 0, confidence: 0 };

  for (const edge of path) {
    if (points.length === 0) points.push({ lat: graph.nodes.get(edge.a).lat, lng: graph.nodes.get(edge.a).lng });
    points.push({ lat: graph.nodes.get(edge.b).lat, lng: graph.nodes.get(edge.b).lng });
    steps.push({
      road_name: edge.road_name,
      from: edge.aLabel,
      to: edge.bLabel,
      distance_km: Number(edge.distanceKm.toFixed(1)),
      risk: Number(edge.terms.hazard.toFixed(2)),
      closure_status: edge.segment.closure_status,
      flood_exposure: edge.segment.flood_exposure ?? null,
    });

    const c = edgeCosts(edge, weights, "risk");
    distanceKm += edge.distanceKm;
    timeMin += edge.timeMin;
    baseSum += c.base;
    riskWeightedSum += c.base * c.risk;
    contribSum.time += weights.time * (edge.timeMin / 60);
    contribSum.distance += weights.distance * edge.distanceKm;
    for (const k of RISK_KEYS) contribSum[k] += c.base * c.contrib[k];

    const trafficFactor = 1 + (edge.terms.traffic ?? 0);
    trafficAdjustedMin += edge.timeMin * trafficFactor;

    for (const h of edge.matchedHazards) {
      if (!hazardsOnRoute.has(h.id ?? h.title)) {
        hazardsOnRoute.set(h.id ?? h.title, {
          id: h.id,
          title: h.title,
          hazard_type: h.hazard_type,
          severity: h.severity,
          data_class: h.data_class,
          source: h.source,
          last_update: h.last_update ?? h.updated_date,
          confidence: h.confidence,
          affected_road: edge.road_name,
          is_demonstration: h.is_demonstration,
        });
      }
    }

    if (edge.segment.closure_status === "closed_confirmed" || edge.segment.closure_status === "restricted") {
      closures.push({
        road_name: edge.road_name,
        status: edge.segment.closure_status,
        source: edge.segment.source,
        last_verified: edge.segment.last_verified,
      });
    }

    if (edge.segment.traffic_level && edge.segment.traffic_level !== "unknown") {
      const entry = { road_name: edge.road_name, level: edge.segment.traffic_level };
      if (edge.segment.traffic_is_disaster_related) disasterTraffic.push(entry);
      else ordinaryTraffic.push(entry);
    }

    confidenceValues.push(num(edge.segment.data_confidence, 0.6));
    if (edge.segment.traffic_level === "unknown") unknownFlags.traffic += 1;
    if (edge.segment.surface_damage === "unknown") unknownFlags.damage += 1;
    if (edge.segment.closure_status === "unknown") unknownFlags.closure += 1;
    if (edge.segment.last_verified == null) unknownFlags.confidence += 1;
  }

  const totalCost = baseSum + riskWeightedSum;
  const factors = FACTORS.map((f) => {
    const contribution = Math.max(0, contribSum[f.key] ?? 0);
    return {
      key: f.key,
      weight: weights[f.key] ?? 0,
      contribution: Number(contribution.toFixed(4)),
      share: totalCost > 0 ? Number((contribution / totalCost).toFixed(4)) : 0,
    };
  }).sort((x, y) => y.contribution - x.contribution);

  const riskScore = baseSum > 0 ? riskWeightedSum / baseSum : 0;
  const minConfidence = confidenceValues.length ? Math.min(...confidenceValues) : null;
  const avgConfidence = confidenceValues.length
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : null;
  const ages = path
    .map((e) => ageHours(e.segment.last_verified ?? e.segment.updated_date, nowMs))
    .filter((a) => a != null);

  return {
    key,
    label,
    origin_label: originLabel,
    destination_label: destLabel,
    points,
    steps,
    distance_km: Number(distanceKm.toFixed(1)),
    travel_time_min: Math.round(timeMin),
    traffic_adjusted_min: Math.round(trafficAdjustedMin),
    traffic_supported: path.some((e) => e.segment.traffic_level && e.segment.traffic_level !== "unknown"),
    risk_score: Number(riskScore.toFixed(4)),
    factors,
    hazards: [...hazardsOnRoute.values()],
    closures,
    traffic: { disaster_related: disasterTraffic, ordinary: ordinaryTraffic },
    uncertainty: {
      min_confidence: minConfidence == null ? null : Number(minConfidence.toFixed(2)),
      avg_confidence: avgConfidence == null ? null : Number(avgConfidence.toFixed(2)),
      oldest_evidence_hours: ages.length ? Number(Math.max(...ages).toFixed(1)) : null,
      newest_evidence_hours: ages.length ? Number(Math.min(...ages).toFixed(1)) : null,
      unknown_flags: unknownFlags,
      segments: path.length,
      demonstration_segments: path.filter((e) => e.segment.is_demonstration).length,
      sources: [...new Set(path.map((e) => e.segment.source).filter(Boolean))],
    },
    engine_cost: Number(totalCost.toFixed(4)),
  };
}

function suitabilityFor(route, { mode, preferences }) {
  const reasons = [];
  const walkLimit = preferences.max_walk_km;

  if (mode === "walking" && walkLimit && route.distance_km > walkLimit) {
    reasons.push({
      code: "walk_distance",
      text: `Walking distance ${route.distance_km} km exceeds your ${walkLimit} km limit.`,
    });
  }

  for (const step of route.steps) {
    if (step.closure_status === "closed_confirmed") {
      reasons.push({ code: "closure", text: `${step.road_name} carries a confirmed closure.` });
    }
  }

  if (route.uncertainty.min_confidence != null && route.uncertainty.min_confidence < 0.45) {
    reasons.push({
      code: "low_confidence",
      text: `At least one segment has data confidence below 45% (${Math.round(route.uncertainty.min_confidence * 100)}%).`,
    });
  }

  if (preferences.mobility_needs && route.steps.some((s) => s.stairs)) {
    reasons.push({ code: "stairs", text: "The route includes a stair crossing." });
  }

  return reasons;
}

function floodBlocked(route, mode) {
  const limit = mode === "walking" ? 0.6 : 0.85;
  const hit = route.steps.filter((s) => (s.flood_exposure ?? 0) >= limit);
  if (hit.length === 0) return null;
  return {
    code: "flood_exposure",
    text:
      mode === "walking"
        ? `${hit[0].road_name} has flood exposure above the pedestrian limit (${Math.round(limit * 100)}%). A person must not be routed through inundated water.`
        : `${hit[0].road_name} has flood exposure above the vehicle limit (${Math.round(limit * 100)}%). A vehicle is not assumed to pass through floodwater.`,
  };
}

// Penalty-method alternative generation: after each route, the segments it uses
// are made more expensive and the search repeats, which yields genuinely
// different corridors rather than cosmetic variations of the same road.
export function planRoutesGraph({ network, request, nowMs = Date.now() }) {
  const mode = request.mode ?? "driving";
  const preferences = {
    pets: false,
    luggage: false,
    children: false,
    older_adults: false,
    mobility_needs: false,
    max_walk_km: 6,
    destination_need: "any",
    priority: "balanced",
    ...(request.preferences ?? {}),
  };
  const weights = { ...DEFAULT_WEIGHTS, ...(request.weights ?? {}) };

  // Personal circumstances adjust the weights rather than overriding them.
  if (preferences.mobility_needs) {
    weights.damage = (weights.damage ?? 0) + 0.6;
    weights.uncertainty = (weights.uncertainty ?? 0) + 0.3;
    weights.hazard = (weights.hazard ?? 0) + 0.2;
  }
  if (preferences.children || preferences.older_adults) weights.hazard = (weights.hazard ?? 0) + 0.35;
  if (preferences.pets) weights.uncertainty = (weights.uncertainty ?? 0) + 0.1;

  const graph = buildGraph({
    segments: network.segments,
    hazards: network.hazards,
    mode,
    preferences,
    nowMs,
  });

  const engineNotice = network.segments.some((s) => s.is_demonstration)
    ? "Routing runs on the internal corridor graph (demonstration network). These are not surveyed road geometries."
    : "Routing runs on the internal road graph supplied by the app's data sources.";

  const base = {
    engine: "internal_corridor_graph",
    engine_version: ENGINE_VERSION,
    engine_notice: engineNotice,
    mode,
    preferences,
    weights,
    network: {
      nodes: graph.nodes.size,
      segments: graph.edges.length,
      hard_closed_removed: graph.hardClosed.length,
      rejected_segments: graph.rejected.length,
      demonstration: network.segments.some((s) => s.is_demonstration),
    },
    hard_closed: graph.hardClosed,
    soft_closures: graph.softClosures,
    data_snapshot_at: new Date(nowMs).toISOString(),
    candidates: [],
    excluded: [],
    ok: false,
  };

  const originPoint = request.origin;
  const destPoint = request.destination;
  if (!originPoint || !destPoint) {
    return { ...base, reason: "missing_endpoints", message: "A start point and a destination are required." };
  }

  const startSnap = nearestNode(graph, originPoint);
  const endSnap = nearestNode(graph, destPoint);
  if (!startSnap || !endSnap) {
    return { ...base, reason: "empty_network", message: "The road graph has no usable segments yet." };
  }
  if (startSnap.distanceKm > 40 || endSnap.distanceKm > 40) {
    return {
      ...base,
      reason: "outside_network",
      message:
        "This start or destination is more than 40 km from any node of the current road graph, so no supported route can be computed. Follow official instructions or contact emergency services.",
      origin_snap: { label: startSnap.node.label, distance_km: Number(startSnap.distanceKm.toFixed(1)) },
      destination_snap: { label: endSnap.node.label, distance_km: Number(endSnap.distanceKm.toFixed(1)) },
    };
  }

  const startKey = startSnap.node.key;
  const goalKey = endSnap.node.key;

  if (startKey === goalKey && startSnap.distanceKm < 0.6 && endSnap.distanceKm < 0.6) {
    return { ...base, reason: "same_node", message: "Start and destination resolve to the same network node." };
  }

  const primary = dijkstra(graph, startKey, goalKey, weights, "risk");
  if (!primary) {
    return {
      ...base,
      reason: "no_path",
      message:
        "No route exists in the current graph after applying confirmed closures. Treat the area as unreachable by road and follow official instructions.",
      origin_snap: { label: startSnap.node.label, distance_km: Number(startSnap.distanceKm.toFixed(1)) },
      destination_snap: { label: endSnap.node.label, distance_km: Number(endSnap.distanceKm.toFixed(1)) },
    };
  }

  const found = [{ path: primary.edges, label: "Recommended", cost: primary.cost }];
  const seen = new Set([signature(primary.edges)]);

  const penalised = new Map();
  for (let round = 0; round < 3; round += 1) {
    const last = found[found.length - 1];
    for (const e of last.path) penalised.set(e.id, (penalised.get(e.id) ?? 0) + 1);
    const alt = dijkstra(graph, startKey, goalKey, weights, "risk", penalised);
    if (!alt) break;
    const sig = signature(alt.edges);
    if (seen.has(sig)) break;
    seen.add(sig);
    found.push({ path: alt.edges, label: `Alternative ${found.length}`, cost: alt.cost });
  }

  const originLabel = request.origin.label ?? startSnap.node.label;
  const destLabel = request.destination.label ?? endSnap.node.label;

  const candidates = found.map((f, i) =>
    summariseRoute({
      key: `route-${String.fromCharCode(97 + i)}`,
      label: f.label,
      path: f.path,
      graph,
      weights,
      nowMs,
      originLabel,
      destLabel,
    }),
  );

  // Baselines for comparison: the true shortest and the fastest route.
  const shortest = dijkstra(graph, startKey, goalKey, weights, "shortest");
  const fastest = dijkstra(graph, startKey, goalKey, weights, "fastest");
  const shortestSummary = shortest
    ? summariseRoute({
        key: "baseline-shortest",
        label: "Shortest distance",
        path: shortest.edges,
        graph,
        weights,
        nowMs,
        originLabel,
        destLabel,
      })
    : null;
  const fastestSummary = fastest
    ? summariseRoute({
        key: "baseline-fastest",
        label: "Fastest",
        path: fastest.edges,
        graph,
        weights,
        nowMs,
        originLabel,
        destLabel,
      })
    : null;

  const ranked = [...candidates].sort((a, b) => a.risk_score - b.risk_score);
  const recommended = ranked[0];

  for (const route of candidates) {
    const blocked = floodBlocked(route, mode);
    const reasons = suitabilityFor(route, { mode, preferences });
    if (blocked) route.blocked = blocked;
    route.exclusion_reasons = reasons;
    route.suitable = !blocked;
    route.extra_km = shortestSummary ? Number((route.distance_km - shortestSummary.distance_km).toFixed(1)) : null;
    route.extra_min = shortestSummary ? route.travel_time_min - shortestSummary.travel_time_min : null;
    route.hazards_avoided = shortestSummary
      ? shortestSummary.hazards.filter((h) => !route.hazards.some((r) => r.id === h.id))
      : [];
    route.hazards_added = shortestSummary
      ? route.hazards.filter((h) => !shortestSummary.hazards.some((r) => r.id === h.id))
      : [];
  }

  const feasible = candidates.filter((c) => c.suitable);

  const excluded = candidates
    .filter((c) => !c.suitable)
    .map((c) => ({
      key: c.key,
      label: c.label,
      distance_km: c.distance_km,
      travel_time_min: c.travel_time_min,
      risk_score: c.risk_score,
      reasons: [c.blocked, ...c.exclusion_reasons].filter(Boolean),
    }));

  const recommendedRoute = feasible[0] ?? null;

  // Rank-difference explanation: which factors separate the top two routes.
  let versus = null;
  if (feasible.length > 1) {
    const [first, second] = feasible;
    const sharedKeys = first.factors.map((f) => f.key);
    const deltas = sharedKeys
      .map((k) => {
        const a = first.factors.find((f) => f.key === k)?.share ?? 0;
        const b = second.factors.find((f) => f.key === k)?.share ?? 0;
        return { key: k, delta: a - b };
      })
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    versus = {
      other_key: second.key,
      other_label: second.label,
      risk_delta: Number((second.risk_score - first.risk_score).toFixed(4)),
      distance_delta_km: Number((second.distance_km - first.distance_km).toFixed(1)),
      time_delta_min: second.travel_time_min - first.travel_time_min,
      biggest_factor_differences: deltas.slice(0, 3),
    };
  }

  const facilitiesNearRoute = network.shelters
    .map((s) => {
      const nearest = candidates.length
        ? Math.min(...candidates[0].points.map((p) => haversineKm(p, { lat: s.lat, lng: s.lng })))
        : null;
      return { ...s, distance_to_route_km: nearest == null ? null : Number(nearest.toFixed(1)) };
    })
    .filter((s) => s.distance_to_route_km != null && s.distance_to_route_km <= 6)
    .sort((a, b) => a.distance_to_route_km - b.distance_to_route_km)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      name: s.name,
      facility_type: s.facility_type,
      district: s.district,
      lat: s.lat,
      lng: s.lng,
      capacity_status: s.capacity_status,
      verification_status: s.verification_status,
      distance_to_route_km: s.distance_to_route_km,
    }));

  const destinationServed = preferences.destination_need === "any"
    ? null
    : facilitiesNearRoute.filter((f) => f.facility_type === preferences.destination_need);

  return {
    ...base,
    ok: feasible.length > 0,
    reason: feasible.length > 0 ? null : "no_supported_route",
    message:
      feasible.length > 0
        ? null
        : "Every candidate route violates a constraint you set (flood limits, walking distance or data confidence). No adequately supported route can be recommended — follow official instructions or contact emergency services.",
    origin_snap: { label: startSnap.node.label, distance_km: Number(startSnap.distanceKm.toFixed(1)) },
    destination_snap: { label: endSnap.node.label, distance_km: Number(endSnap.distanceKm.toFixed(1)) },
    candidates,
    ranked,
    recommended_key: recommendedRoute?.key ?? null,
    excluded,
    versus,
    baselines: { shortest: shortestSummary, fastest: fastestSummary },
    facilities_near_route: facilitiesNearRoute,
    destination_served: destinationServed,
    penalty_applied: found.length > 1,
  };
}

// ---------------------------------------------------------------------------
// OSRM-backed routing: real road geometry with hazard proximity scoring.
//
// This is the primary path. It calls OSRM for actual navigable road geometry,
// then computes which hazards fall within proximity of the route. The factor
// breakdown is a transparent additive decomposition — not a model attribution.
// If OSRM is unavailable, it falls back to the internal corridor graph.
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT_OS = { low: 0.25, caution: 0.5, elevated: 0.75, severe: 1 };

function osrmCandidate({ key, label, osrmRoute, hazards, weights, originLabel, destLabel, nowMs }) {
  const points = osrmRoute.points;
  const distanceKm = Number(osrmRoute.distance_km.toFixed(1));
  const timeMin = Math.round(osrmRoute.duration_min);
  const hazardsOn = hazardsNearRoute(points, hazards);

  const base = weights.time * (timeMin / 60) + weights.distance * distanceKm;
  const hazardTerm = hazardsOn.reduce((sum, h) => {
    const s = SEVERITY_WEIGHT_OS[h.severity] ?? 0.5;
    const c = typeof h.confidence === "number" ? h.confidence : 0.6;
    const dist = h.nearest_distance_km ?? 0;
    const decay = Math.max(0.2, 1 - dist / 2);
    return sum + s * c * decay;
  }, 0);
  const risk = weights.hazard * hazardTerm;
  const riskScore = base > 0 ? risk / base : 0;
  const totalCost = base + base * risk;

  const factors = [
    { key: "time", weight: weights.time, contribution: Number((weights.time * (timeMin / 60)).toFixed(4)), share: 0 },
    { key: "distance", weight: weights.distance, contribution: Number((weights.distance * distanceKm).toFixed(4)), share: 0 },
    { key: "hazard", weight: weights.hazard, contribution: Number((base * risk).toFixed(4)), share: 0 },
    ...FACTORS.filter((f) => !["time", "distance", "hazard"].includes(f.key)).map((f) => ({
      key: f.key,
      weight: weights[f.key] ?? 0,
      contribution: 0,
      share: 0,
    })),
  ].sort((a, b) => b.contribution - a.contribution);

  for (const f of factors) {
    f.share = totalCost > 0 ? Number((f.contribution / totalCost).toFixed(4)) : 0;
  }

  return {
    key,
    label,
    origin_label: originLabel,
    destination_label: destLabel,
    points,
    steps: osrmRoute.steps ?? [],
    distance_km: distanceKm,
    travel_time_min: timeMin,
    traffic_adjusted_min: timeMin,
    traffic_supported: false,
    risk_score: Number(riskScore.toFixed(4)),
    factors,
    hazards: hazardsOn.map((h) => ({
      id: h.id,
      title: h.title,
      hazard_type: h.hazard_type,
      severity: h.severity,
      data_class: h.data_class,
      source: h.source,
      last_update: h.last_update ?? h.updated_date,
      confidence: h.confidence,
      affected_road: h.district ?? "proximity",
      is_demonstration: h.is_demonstration,
      nearest_distance_km: h.nearest_distance_km,
    })),
    closures: [],
    traffic: { disaster_related: [], ordinary: [] },
    uncertainty: {
      min_confidence: hazardsOn.length ? Math.min(...hazardsOn.map((h) => (typeof h.confidence === "number" ? h.confidence : 0.6))) : null,
      avg_confidence: hazardsOn.length ? hazardsOn.reduce((s, h) => s + (typeof h.confidence === "number" ? h.confidence : 0.6), 0) / hazardsOn.length : null,
      oldest_evidence_hours: null,
      newest_evidence_hours: null,
      unknown_flags: { traffic: 0, damage: 0, closure: 0, confidence: 0 },
      segments: points.length,
      demonstration_segments: hazardsOn.filter((h) => h.is_demonstration).length,
      sources: [...new Set(hazardsOn.map((h) => h.source).filter(Boolean))],
    },
    engine_cost: Number(totalCost.toFixed(4)),
    suitable: true,
    hazards_avoided: [],
    hazards_added: [],
  };
}

export async function planRoutes({ network, request, nowMs = Date.now() }) {
  const mode = request.mode ?? "driving";
  const preferences = {
    pets: false, luggage: false, children: false, older_adults: false,
    mobility_needs: false, max_walk_km: 6, destination_need: "any", priority: "balanced",
    ...(request.preferences ?? {}),
  };
  const weights = { ...DEFAULT_WEIGHTS, ...(request.weights ?? {}) };

  if (preferences.mobility_needs) {
    weights.damage = (weights.damage ?? 0) + 0.6;
    weights.uncertainty = (weights.uncertainty ?? 0) + 0.3;
    weights.hazard = (weights.hazard ?? 0) + 0.2;
  }
  if (preferences.children || preferences.older_adults) weights.hazard = (weights.hazard ?? 0) + 0.35;

  const originPoint = request.origin;
  const destPoint = request.destination;
  if (!originPoint || !destPoint) {
    return planRoutesGraph({ network, request, nowMs });
  }

  let osrmRoutes = null;
  try {
    osrmRoutes = await osrmRoute(originPoint, destPoint, mode);
  } catch {
    osrmRoutes = null;
  }

  if (!osrmRoutes || osrmRoutes.length === 0) {
    return planRoutesGraph({ network, request, nowMs });
  }

  const originLabel = originPoint.label ?? "Origin";
  const destLabel = destPoint.label ?? "Destination";
  const hazards = network.hazards ?? [];

  const candidates = osrmRoutes.slice(0, 4).map((r, i) =>
    osrmCandidate({
      key: `route-${String.fromCharCode(97 + i)}`,
      label: i === 0 ? "Recommended" : `Alternative ${i}`,
      osrmRoute: r,
      hazards,
      weights,
      originLabel,
      destLabel,
      nowMs,
    }),
  );

  const ranked = [...candidates].sort((a, b) => a.risk_score - b.risk_score);
  const recommended = ranked[0];
  const recommendedRoute = candidates.find((c) => c.key === recommended.key);

  // Shortest baseline = the OSRM route with the least distance.
  const shortestRoute = [...candidates].sort((a, b) => a.distance_km - b.distance_km)[0];
  const shortestSummary = {
    ...shortestRoute,
    key: "baseline-shortest",
    label: "Shortest distance",
  };

  for (const route of candidates) {
    route.extra_km = Number((route.distance_km - shortestSummary.distance_km).toFixed(1));
    route.extra_min = route.travel_time_min - shortestSummary.travel_time_min;
    route.hazards_avoided = shortestSummary.hazards.filter((h) => !route.hazards.some((r) => r.id === h.id));
    route.hazards_added = route.hazards.filter((h) => !shortestSummary.hazards.some((r) => r.id === h.id));
  }

  let versus = null;
  if (candidates.length > 1) {
    const [first, second] = ranked;
    versus = {
      other_key: second.key,
      other_label: second.label,
      risk_delta: Number((second.risk_score - first.risk_score).toFixed(4)),
      distance_delta_km: Number((second.distance_km - first.distance_km).toFixed(1)),
      time_delta_min: second.travel_time_min - first.travel_time_min,
      biggest_factor_differences: first.factors
        .map((f) => ({ key: f.key, delta: f.share - (second.factors.find((x) => x.key === f.key)?.share ?? 0) }))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 3),
    };
  }

  const facilitiesNearRoute = (network.shelters ?? [])
    .map((s) => {
      const nearest = candidates.length
        ? Math.min(...candidates[0].points.map((p) => haversineKm(p, { lat: s.lat, lng: s.lng })))
        : null;
      return { ...s, distance_to_route_km: nearest == null ? null : Number(nearest.toFixed(1)) };
    })
    .filter((s) => s.distance_to_route_km != null && s.distance_to_route_km <= 6)
    .sort((a, b) => a.distance_to_route_km - b.distance_to_route_km)
    .slice(0, 8)
    .map((s) => ({
      id: s.id, name: s.name, facility_type: s.facility_type, district: s.district,
      lat: s.lat, lng: s.lng, capacity_status: s.capacity_status,
      verification_status: s.verification_status, distance_to_route_km: s.distance_to_route_km,
    }));

  const isDemo = network.segments?.some((s) => s.is_demonstration) || hazards.some((h) => h.is_demonstration);

  return {
    engine: "osrm_road_network",
    engine_version: ENGINE_VERSION,
    engine_notice: "Routing uses real road geometry from OpenStreetMap via the OSRM routing service. Hazard exposure is computed by proximity of the route geometry to known hazard zones.",
    mode,
    preferences,
    weights,
    network: {
      nodes: 0,
      segments: 0,
      hard_closed_removed: 0,
      rejected_segments: 0,
      demonstration: isDemo,
      osrm: true,
    },
    hard_closed: [],
    soft_closures: [],
    data_snapshot_at: new Date(nowMs).toISOString(),
    candidates,
    ranked,
    recommended_key: recommendedRoute?.key ?? null,
    excluded: [],
    versus,
    baselines: { shortest: shortestSummary, fastest: null },
    facilities_near_route: facilitiesNearRoute,
    destination_served: null,
    penalty_applied: candidates.length > 1,
    ok: candidates.length > 0,
    origin_snap: { label: originLabel, distance_km: 0 },
    destination_snap: { label: destLabel, distance_km: 0 },
  };
}

/** Light network payload for the client-side positioning simulation. */
export function simulationNetwork(network) {
  return {
    nodes: [...new Set(network.segments.flatMap((s) => [s.from_name, s.to_name]))].length,
    segments: network.segments.map((s) => ({
      id: s.segment_id ?? s.id,
      road_name: s.road_name,
      from_name: s.from_name,
      to_name: s.to_name,
      from_lat: s.from_lat,
      from_lng: s.from_lng,
      to_lat: s.to_lat,
      to_lng: s.to_lng,
      district: s.district,
      distance_km: s.distance_km,
      data_confidence: s.data_confidence,
      closure_status: s.closure_status,
      is_demonstration: s.is_demonstration,
    })),
    hazards: network.hazards.map((h) => ({
      id: h.id,
      title: h.title,
      hazard_type: h.hazard_type,
      severity: h.severity,
      lat: h.lat,
      lng: h.lng,
      radius_km: h.radius_km,
      data_class: h.data_class,
    })),
  };
}