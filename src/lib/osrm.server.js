// Real road routing via the OSRM public demo server.
//
// Returns actual road geometry (GeoJSON LineString coordinates) so the map
// draws navigable roads instead of straight lines between graph nodes.
// The OSRM demo server is free but rate-limited; callers must handle failures
// and fall back to the internal corridor graph.
//
// Hazard proximity is computed against the real geometry: a hazard is "on"
// the route if any geometry point falls within the hazard's radius (or a
// default 2 km threshold).

import { haversineKm } from "@/lib/geo";

const OSRM_BASE = "https://router.project-osrm.org/route/v1";

const PROFILE = { walking: "foot", cycling: "bike", driving: "driving" };

const DEFAULT_HAZARD_RADIUS_KM = 2;

const MANEUVER_MODIFIER = {
  uturn: "U-turn",
  "sharp right": "sharp right",
  right: "right",
  "slight right": "slight right",
  straight: "straight",
  "slight left": "slight left",
  left: "left",
  "sharp left": "sharp left",
};

function formatStep(step) {
  const maneuver = step.maneuver ?? {};
  const type = maneuver.type ?? "continue";
  const modifier = maneuver.modifier ?? "straight";
  const name = step.name ?? "";
  const mod = MANEUVER_MODIFIER[modifier] ?? modifier;
  const loc = maneuver.location; // [lng, lat]

  let instruction;
  if (type === "depart") instruction = name ? `Head ${mod} on ${name}` : "Head out";
  else if (type === "arrive") instruction = "Arrive at your destination";
  else if (type === "turn") instruction = name ? `Turn ${mod} onto ${name}` : `Turn ${mod}`;
  else if (type === "new name") instruction = name ? `Continue onto ${name}` : "Continue";
  else if (type === "merge") instruction = name ? `Merge ${mod} onto ${name}` : `Merge ${mod}`;
  else if (type === "on ramp") instruction = name ? `Take the ramp onto ${name}` : "Take the ramp";
  else if (type === "off ramp") instruction = name ? `Take the exit onto ${name}` : "Take the exit";
  else if (type === "fork") instruction = name ? `Keep ${mod} at the fork onto ${name}` : `Keep ${mod} at the fork`;
  else if (type === "end of road") instruction = name ? `Turn ${mod} at the end of ${name}` : `Turn ${mod} at the end of the road`;
  else if (type === "continue") instruction = name ? `Continue ${mod} on ${name}` : "Continue";
  else if (type === "roundabout" || type === "rotary") instruction = name ? `Enter the roundabout and exit onto ${name}` : "Enter the roundabout";
  else if (type === "roundabout turn") instruction = name ? `At the roundabout, turn ${mod} onto ${name}` : `At the roundabout, turn ${mod}`;
  else instruction = name ? `Continue on ${name}` : "Continue";

  const points = (step.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }));

  return {
    instruction,
    road: name,
    distance_m: step.distance ?? 0,
    duration_s: step.duration ?? 0,
    maneuver_type: type,
    maneuver_modifier: modifier,
    location: loc ? { lat: loc[1], lng: loc[0] } : null,
    points,
  };
}

/**
 * Fetch real road routes from OSRM.
 * Returns an array of { points: [{lat,lng}], distance_km, duration_min, steps }.
 * Throws on network or API failure.
 */
export async function osrmRoute(origin, destination, mode) {
  const profile = PROFILE[mode] ?? "driving";
  const coord = (p) => `${p.lng},${p.lat}`;
  const url =
    `${OSRM_BASE}/${profile}/${coord(origin)};${coord(destination)}` +
    `?overview=full&geometries=geojson&alternatives=true&steps=true`;

  const res = await fetch(url, {
    headers: { "User-Agent": "X-MADRL/1.0 (disaster navigation platform)" },
  });

  if (!res.ok) {
    throw new Error(`OSRM responded ${res.status}`);
  }

  const data = await res.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || "OSRM returned no route");
  }

  return data.routes.map((r) => {
    const steps = (r.legs ?? []).flatMap((leg) => (leg.steps ?? []).map(formatStep));
    return {
      points: (r.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
      distance_km: r.distance / 1000,
      duration_min: r.duration / 60,
      steps,
    };
  });
}

/**
 * Given a route's geometry points and a list of hazards, return the hazards
 * that are within proximity of the route. Each hazard is annotated with the
 * nearest distance to the route.
 */
export function hazardsNearRoute(points, hazards) {
  if (!points || points.length === 0 || !hazards) return [];
  const seen = new Map();

  for (const h of hazards) {
    const radius = h.radius_km > 0 ? h.radius_km : DEFAULT_HAZARD_RADIUS_KM;
    let nearest = Infinity;
    for (const p of points) {
      const d = haversineKm(p, { lat: h.lat, lng: h.lng });
      if (d < nearest) nearest = d;
      if (d <= radius) break;
    }
    if (nearest <= radius) {
      seen.set(h.id ?? h.title, { ...h, nearest_distance_km: Number(nearest.toFixed(2)) });
    }
  }

  return [...seen.values()];
}

/**
 * Simplified risk score for an OSRM route based on nearby hazards.
 * This is NOT a model attribution — it is a transparent additive score:
 *   risk = Σ severity_weight * confidence * proximity_decay
 */
export function routeRiskScore(hazardsOnRoute) {
  if (!hazardsOnRoute || hazardsOnRoute.length === 0) return 0;
  const sev = { low: 0.25, caution: 0.5, elevated: 0.75, severe: 1 };
  let total = 0;
  for (const h of hazardsOnRoute) {
    const s = sev[h.severity] ?? 0.5;
    const c = typeof h.confidence === "number" ? h.confidence : 0.6;
    const dist = h.nearest_distance_km ?? 0;
    const decay = Math.max(0.2, 1 - dist / DEFAULT_HAZARD_RADIUS_KM);
    total += s * c * decay;
  }
  return Number(total.toFixed(4));
}