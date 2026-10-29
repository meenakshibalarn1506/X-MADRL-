// Shared configuration for the risk-aware routing engine.
// The engine itself lives on the server (src/lib/routing.server.js); these
// constants and labels are shared with the interface so a score shown on a card
// is always produced by the same function that ranked the route.

export const TRAVEL_MODES = [
  { key: "walking", en: "Walking", ta: "நடைபயணம்", baseSpeedKmh: 4.6 },
  { key: "cycling", en: "Cycling", ta: "சைக்கிள்", baseSpeedKmh: 15 },
  { key: "driving", en: "Driving", ta: "வாகனம்", baseSpeedKmh: 38 },
];

export const MODE_BY_KEY = Object.fromEntries(TRAVEL_MODES.map((m) => [m.key, m]));

// Additive risk factors. Every route score is the sum of these eight terms, so
// the contribution shown in the Explainable AI panel is an exact share of the
// total — it is not an approximated model attribution.
export const FACTORS = [
  { key: "hazard", en: "Hazard exposure", ta: "ஆபத்து வெளிப்பாடு" },
  { key: "closure", en: "Closures & restrictions", ta: "சாலை மூடல்" },
  { key: "flood", en: "Flood / inundation exposure", ta: "வெள்ள அபாயம்" },
  { key: "damage", en: "Surface damage", ta: "சாலை சேதம்" },
  { key: "traffic", en: "Traffic conditions", ta: "போக்குவரத்து" },
  { key: "uncertainty", en: "Data uncertainty & age", ta: "தரவு நிச்சயமற்ற தன்மை" },
  { key: "time", en: "Travel time", ta: "பயண நேரம்" },
  { key: "distance", en: "Distance", ta: "தூரம்" },
];

export const FACTOR_BY_KEY = Object.fromEntries(FACTORS.map((f) => [f.key, f]));

export const DEFAULT_WEIGHTS = {
  hazard: 1.0,
  closure: 1.4,
  flood: 0.9,
  damage: 0.4,
  traffic: 0.5,
  uncertainty: 0.6,
  time: 0.35,
  distance: 0.2,
};

export const PRIORITY_PRESETS = {
  balanced: { label: "Balanced", en: "Balanced", ta: "சமநிலை", weights: DEFAULT_WEIGHTS },
  low_hazard: {
    label: "Lowest hazard exposure",
    en: "Lowest hazard exposure",
    ta: "குறைந்த ஆபத்து",
    weights: { hazard: 2.4, closure: 2.0, flood: 1.8, damage: 0.5, traffic: 0.4, uncertainty: 0.7, time: 0.12, distance: 0.08 },
  },
  fastest: {
    label: "Fastest",
    en: "Fastest",
    ta: "விரைவானது",
    weights: { hazard: 0.6, closure: 1.4, flood: 0.5, damage: 0.3, traffic: 0.9, uncertainty: 0.4, time: 1.8, distance: 0.15 },
  },
  shortest: {
    label: "Shortest distance",
    en: "Shortest distance",
    ta: "குறுகிய தூரம்",
    weights: { hazard: 0.5, closure: 1.4, flood: 0.5, damage: 0.3, traffic: 0.3, uncertainty: 0.4, time: 0.25, distance: 1.9 },
  },
  accessible: {
    label: "Accessibility first",
    en: "Accessibility first",
    ta: "அணுகல் முதலில்",
    weights: { hazard: 1.3, closure: 1.4, flood: 1.2, damage: 1.0, traffic: 0.5, uncertainty: 1.0, time: 0.3, distance: 0.18 },
  },
};

export const RISK_BANDS = [
  { key: "low", max: 0.24 },
  { key: "caution", max: 0.44 },
  { key: "elevated", max: 0.66 },
  { key: "severe", max: Number.POSITIVE_INFINITY },
];

export function bandFor(score) {
  if (score == null || Number.isNaN(score)) return "unknown";
  const found = RISK_BANDS.find((b) => score <= b.max);
  return found ? found.key : "severe";
}

export const BAND_LABEL = {
  low: { en: "Low assessed risk", ta: "குறைந்த ஆபத்து" },
  caution: { en: "Caution", ta: "எச்சரிக்கை" },
  elevated: { en: "Elevated risk", ta: "அதிக ஆபத்து" },
  severe: { en: "Severe risk", ta: "மிக தீவிர ஆபத்து" },
  unknown: { en: "Risk not assessed", ta: "மதிப்பிடப்படவில்லை" },
};

// Freshness policy. A confirmed closure is only treated as a hard routing
// constraint while it is inside this window and confident enough; otherwise it
// becomes a soft penalty and is flagged as uncertain.
export const FRESHNESS = {
  freshHours: 6,
  ageingHours: 24,
  confirmedClosureMaxAgeHours: 6,
  minConfidenceForHardConstraint: 0.6,
};

export function freshnessOf(iso, nowMs = Date.now()) {
  if (!iso) return { state: "unknown", hours: null };
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { state: "unknown", hours: null };
  const hours = Math.max(0, (nowMs - t) / 3_600_000);
  if (hours <= FRESHNESS.freshHours) return { state: "fresh", hours };
  if (hours <= FRESHNESS.ageingHours) return { state: "ageing", hours };
  return { state: "stale", hours };
}

export const FRESHNESS_LABEL = {
  fresh: { en: "Fresh", ta: "புதியது" },
  ageing: { en: "Ageing", ta: "பழையதாகிறது" },
  stale: { en: "Stale", ta: "பழையது" },
  unknown: { en: "Age unknown", ta: "புதுப்பிப்பு தெரியவில்லை" },
};