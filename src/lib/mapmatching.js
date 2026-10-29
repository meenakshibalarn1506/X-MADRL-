// Map matching and a positioning evaluation harness.
//
// Three matchers run against the same synthetic scenario so their behaviour can
// be compared honestly:
//   1. nearest road       — project every fix onto the closest segment, with no
//                           memory of the previous assignment;
//   2. topology-constrained — Viterbi over candidate segments, so a match that
//                           is not connected to the previous one is penalised;
//   3. confidence-aware    — the same search, but each fix carries an
//                           uncertainty radius: candidates outside it are
//                           rejected and fixes that arrived through dead
//                           reckoning are doubted rather than trusted.
//
// The ground truth here is synthetic and labelled as such. Nothing in this file
// claims to validate real navigation performance.

import { haversineKm, pointToSegmentKm } from "@/lib/geo";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function nodeKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

export function buildAdjacency(segments) {
  const map = new Map();
  for (const s of segments) {
    for (const n of [nodeKey(s.from_name), nodeKey(s.to_name)]) {
      if (!map.has(n)) map.set(n, []);
      map.get(n).push(s);
    }
  }
  return map;
}

function sharesNode(a, b) {
  const an = [nodeKey(a.from_name), nodeKey(a.to_name)];
  const bn = [nodeKey(b.from_name), nodeKey(b.to_name)];
  return an.some((n) => bn.includes(n));
}

export function projectOnSegment(p, segment) {
  const lat0 = p.lat;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.574;
  const ax = segment.from_lng * kx;
  const ay = segment.from_lat * ky;
  const bx = segment.to_lng * kx;
  const by = segment.to_lat * ky;
  const px = p.lng * kx;
  const py = p.lat * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { lat: segment.from_lat + (segment.to_lat - segment.from_lat) * t, lng: segment.from_lng + (segment.to_lng - segment.from_lng) * t, t };
}

export function candidatesFor(p, segments, limit = 6) {
  return segments
    .map((s) => {
      const from = { lat: s.from_lat, lng: s.from_lng };
      const to = { lat: s.to_lat, lng: s.to_lng };
      const distanceKm = pointToSegmentKm(p, from, to);
      return { segment: s, distanceKm, projection: projectOnSegment(p, s) };
    })
    .sort((x, y) => x.distanceKm - y.distanceKm)
    .slice(0, limit);
}

/** Greedy corridor pick: a chain of connected segments, deterministic for a seed. */
export function pickCorridor(segments, seed = 7, maxSegments = 7) {
  const rng = mulberry32(seed);
  const usable = segments.filter(
    (s) => s.from_lat != null && s.to_lat != null && (s.distance_km ?? 0) > 0,
  );
  if (usable.length === 0) return [];
  const startIndex = Math.floor(rng() * usable.length);
  const corridor = [usable[startIndex]];
  const used = new Set([usable[startIndex].id ?? `${usable[startIndex].from_name}-${usable[startIndex].to_name}`]);
  const nodes = [nodeKey(usable[startIndex].to_name)];

  while (corridor.length < maxSegments) {
    const tail = nodes[nodes.length - 1];
    const options = usable.filter((s) => {
      const id = s.id ?? `${s.from_name}-${s.to_name}`;
      if (used.has(id)) return false;
      return nodeKey(s.from_name) === tail || nodeKey(s.to_name) === tail;
    });
    if (options.length === 0) break;
    const chosen = options[Math.floor(rng() * options.length)];
    used.add(chosen.id ?? `${chosen.from_name}-${chosen.to_name}`);
    corridor.push(chosen);
    const otherEnd = nodeKey(chosen.from_name) === tail ? nodeKey(chosen.to_name) : nodeKey(chosen.from_name);
    nodes.push(otherEnd);
  }
  return corridor;
}

export function buildScenario({
  segments,
  seed = 7,
  sampleCount = 140,
  sigmaM = 55,
  dropoutStartFrac = 0.42,
  dropoutLenFrac = 0.14,
  driftMperMin = 140,
  speedKmh = 35,
  dtSeconds = 60,
}) {
  const corridor = pickCorridor(segments, seed);
  if (corridor.length < 2) return null;

  const rng = mulberry32(seed * 31 + 7);
  const stepKm = (speedKmh / 3600) * dtSeconds;

  // Walk the corridor at a constant speed to produce ground truth.
  const truth = [];
  let segIndex = 0;
  let along = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    while (segIndex < corridor.length) {
      const seg = corridor[segIndex];
      const len = seg.distance_km ?? haversineKm({ lat: seg.from_lat, lng: seg.from_lng }, { lat: seg.to_lat, lng: seg.to_lng });
      if (along <= len) {
        const t = len === 0 ? 0 : along / len;
        truth.push({
          index: i,
          lat: seg.from_lat + (seg.to_lat - seg.from_lat) * t,
          lng: seg.from_lng + (seg.to_lng - seg.from_lng) * t,
          segment: seg,
        });
        along += stepKm;
        break;
      }
      along -= len;
      segIndex += 1;
    }
    if (segIndex >= corridor.length) break;
  }

  const dropoutStart = Math.floor(truth.length * dropoutStartFrac);
  const dropoutEnd = Math.min(truth.length - 1, dropoutStart + Math.floor(truth.length * dropoutLenFrac));

  const observations = truth.map((t, i) => {
    const inDropout = i >= dropoutStart && i <= dropoutEnd;
    if (!inDropout) {
      const dLat = (gaussian(rng) * sigmaM) / 111000;
      const dLng = (gaussian(rng) * sigmaM) / (111000 * Math.cos((t.lat * Math.PI) / 180));
      return {
        index: i,
        lat: t.lat + dLat,
        lng: t.lng + dLng,
        accuracyM: Number((sigmaM * (0.7 + rng() * 1.6)).toFixed(1)),
        source: "gnss",
        hasFix: true,
        secondsSinceFix: 0,
      };
    }
    return {
      index: i,
      lat: null,
      lng: null,
      accuracyM: null,
      source: "gnss",
      hasFix: false,
      secondsSinceFix: (i - dropoutStart + 1) * dtSeconds,
    };
  });

  // Dead reckoning: carry the last known velocity forward. This is the drift a
  // device produces when it keeps showing a position after the fix is gone.
  let lastFix = null;
  for (let i = 0; i < observations.length; i += 1) {
    if (observations[i].hasFix) {
      lastFix = { lat: observations[i].lat, lng: observations[i].lng, index: i, velocity: null };
      if (i + 1 < observations.length) {
        lastFix.velocity = {
          dLat: (observations[i + 1]?.lat ?? observations[i].lat) - observations[i].lat,
          dLng: (observations[i + 1]?.lng ?? observations[i].lng) - observations[i].lng,
        };
      }
      continue;
    }
    if (!lastFix) continue;
    const step = observations[i].secondsSinceFix / dtSeconds;
    const extra = (driftMperMin / 1000) * (observations[i].secondsSinceFix / 60);
    const drift = { dLat: extra / 111, dLng: extra / (111 * Math.cos((truth[i].lat * Math.PI) / 180)) };
    observations[i] = {
      ...observations[i],
      lat: lastFix.lat + (lastFix.velocity?.dLat ?? 0) * step + drift.dLat,
      lng: lastFix.lng + (lastFix.velocity?.dLng ?? 0) * step + drift.dLng,
      accuracyM: Math.round(sigmaM + (driftMperMin / 2) * (observations[i].secondsSinceFix / 60)),
      source: "dead_reckoning",
      hasFix: false,
    };
  }

  return {
    corridor,
    truth,
    observations,
    params: {
      seed,
      sampleCount: truth.length,
      sigmaM,
      dropoutStart,
      dropoutEnd,
      dropoutSeconds: (dropoutEnd - dropoutStart + 1) * dtSeconds,
      driftMperMin,
      speedKmh,
      dtSeconds,
    },
  };
}

function nearestRoadMatch(scenario, segments) {
  return scenario.observations.map((o) => {
    const best = candidatesFor({ lat: o.lat, lng: o.lng }, segments, 1)[0];
    return {
      segment: best.segment,
      position: best.projection,
      uncertaintyM: null,
      doubted: !o.hasFix,
    };
  });
}

function viterbi(scenario, segments, { confidenceAware }) {
  const candidateLists = scenario.observations.map((o) => candidatesFor({ lat: o.lat, lng: o.lng }, segments, 6));
  const plausibleKm = ((scenario.params.speedKmh / 3600) * scenario.params.dtSeconds) * 3 + 0.2;

  let prevCosts = candidateLists[0].map((c) => {
    const radius = confidenceAware ? scenario.observations[0].accuracyM : null;
    if (radius != null && c.distanceKm * 1000 > radius * 2.5) return 1e9;
    return c.distanceKm * 1000;
  });
  const backPointers = [];

  for (let i = 1; i < candidateLists.length; i += 1) {
    const obs = scenario.observations[i];
    const radius = confidenceAware ? obs.accuracyM ?? 500 : null;
    const doubtPenalty =
      radius != null && !obs.hasFix ? (obs.secondsSinceFix / scenario.params.dtSeconds) * 0.35 : 0;
    const pointers = [];
    const costs = candidateLists[i].map((c, k) => {
      if (radius != null && c.distanceKm * 1000 > radius * 2.5) {
        pointers[k] = 0;
        return 1e9;
      }
      let bestPrev = Number.POSITIVE_INFINITY;
      let bestIdx = 0;
      candidateLists[i - 1].forEach((p, j) => {
        const jumpKm = haversineKm(p.projection, c.projection);
        const jumpPenalty = jumpKm > plausibleKm ? (jumpKm - plausibleKm) * 6 : 0;
        const topologyPenalty = sharesNode(p.segment, c.segment) ? 0 : 3.5;
        const cost =
          prevCosts[j] + c.distanceKm * 1000 + jumpPenalty * 1000 + (topologyPenalty + doubtPenalty) * 1000;
        if (cost < bestPrev) {
          bestPrev = cost;
          bestIdx = j;
        }
      });
      pointers[k] = bestIdx;
      return bestPrev;
    });
    backPointers.push(pointers);
    prevCosts = costs;
  }

  let endIdx = 0;
  let bestEnd = Number.POSITIVE_INFINITY;
  prevCosts.forEach((c, i) => {
    if (c < bestEnd) {
      bestEnd = c;
      endIdx = i;
    }
  });

  const out = new Array(candidateLists.length);
  let idx = endIdx;
  for (let i = candidateLists.length - 1; i >= 0; i -= 1) {
    const chosen = candidateLists[i][idx] ?? candidateLists[i][0];
    const obs = scenario.observations[i];
    out[i] = {
      segment: chosen.segment,
      position: chosen.projection,
      uncertaintyM: confidenceAware ? Math.round((obs.accuracyM ?? 400) + (obs.hasFix ? 0 : 150)) : null,
      doubted: !obs.hasFix,
    };
    idx = backPointers[i - 1]?.[idx] ?? 0;
  }
  return out;
}

function metricsFor(matches, scenario) {
  const errors = matches.map((m, i) => haversineKm(m.position, scenario.truth[i]) * 1000);
  const sorted = [...errors].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null;
  const mean = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null;

  const truthIds = scenario.truth.map((t) => t.segment.id ?? `${t.segment.from_name}-${t.segment.to_name}`);
  const matchIds = matches.map((m) => m.segment.id ?? `${m.segment.from_name}-${m.segment.to_name}`);
  const correct = matchIds.filter((id, i) => id === truthIds[i]).length;

  // Recovery: how long after the fix resumes does the matcher find the right road again?
  const resumeIdx = scenario.params.dropoutEnd + 1;
  let recovery = null;
  for (let i = resumeIdx; i < matchIds.length; i += 1) {
    if (matchIds[i] === truthIds[i]) {
      recovery = (i - resumeIdx) * scenario.params.dtSeconds;
      break;
    }
  }

  const withRadius = matches.filter((m) => m.uncertaintyM != null);
  const covered = withRadius.filter((m, i) => {
    const index = matches.indexOf(m);
    return errors[index] <= m.uncertaintyM;
  }).length;

  return {
    mean_error_m: mean == null ? null : Number(mean.toFixed(1)),
    p95_error_m: p95 == null ? null : Number(p95.toFixed(1)),
    road_accuracy: matches.length ? Number((correct / matches.length).toFixed(3)) : null,
    recovery_time_s: recovery,
    uncertainty_coverage: withRadius.length ? Number((covered / withRadius.length).toFixed(3)) : null,
    samples: matches.length,
  };
}

const METHOD_LABELS = {
  nearest: "Nearest-road matching",
  topology: "Topology-constrained map matching",
  confidence: "Confidence-aware map matching",
};

export function runMatchingEvaluation({ segments, scenario }) {
  const nearest = nearestRoadMatch(scenario, segments);
  const topology = viterbi(scenario, segments, { confidenceAware: false });
  const confidence = viterbi(scenario, segments, { confidenceAware: true });

  return {
    methods: [
      { key: "nearest", label: METHOD_LABELS.nearest, matches: nearest, metrics: metricsFor(nearest, scenario) },
      { key: "topology", label: METHOD_LABELS.topology, matches: topology, metrics: metricsFor(topology, scenario) },
      { key: "confidence", label: METHOD_LABELS.confidence, matches: confidence, metrics: metricsFor(confidence, scenario) },
    ],
    implemented: ["nearest", "topology", "confidence"],
    note:
      "All three matchers are implemented and run on the same labelled synthetic trace. Metrics are computed against the synthetic ground truth, not against real navigation performance.",
  };
}