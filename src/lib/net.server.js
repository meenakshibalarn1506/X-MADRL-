// Shared server helpers for loading the hazard/road network.

export function pageItems(res) {
  if (Array.isArray(res)) return res;
  return res?.items ?? [];
}

export function num(v, fallback = null) {
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function ageHours(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (nowMs - t) / 3_600_000);
}

/** Hazards that are still relevant: not withdrawn, and not past their expiry. */
export function activeHazards(hazards, nowMs = Date.now()) {
  return hazards.filter((h) => {
    if (h.review_status === "withdrawn") return false;
    if (h.expires_at) {
      const t = Date.parse(h.expires_at);
      if (!Number.isNaN(t) && t < nowMs) return false;
    }
    return true;
  });
}

export function lightSegment(s) {
  return {
    id: s.id,
    segment_id: s.segment_id,
    road_name: s.road_name,
    road_class: s.road_class,
    from_name: s.from_name,
    to_name: s.to_name,
    from_lat: s.from_lat,
    from_lng: s.from_lng,
    to_lat: s.to_lat,
    to_lng: s.to_lng,
    district: s.district,
    distance_km: s.distance_km,
    speed_kmh: s.speed_kmh,
    traffic_level: s.traffic_level,
    traffic_is_disaster_related: s.traffic_is_disaster_related,
    closure_status: s.closure_status,
    flood_exposure: s.flood_exposure,
    surface_damage: s.surface_damage,
    pedestrian_allowed: s.pedestrian_allowed,
    footpath: s.footpath,
    stairs: s.stairs,
    data_confidence: s.data_confidence,
    source: s.source,
    last_verified: s.last_verified,
    is_demonstration: s.is_demonstration,
  };
}

export function lightHazard(h) {
  return {
    id: h.id,
    title: h.title,
    hazard_type: h.hazard_type,
    severity: h.severity,
    data_class: h.data_class,
    district: h.district,
    lat: h.lat,
    lng: h.lng,
    radius_km: h.radius_km,
    review_status: h.review_status,
    verification_status: h.verification_status,
    confidence: h.confidence,
    source: h.source,
    last_update: h.last_update ?? h.updated_date,
    started_at: h.started_at,
    expires_at: h.expires_at,
    description: h.description,
    precautions: h.precautions,
    affected_segment_ids: h.affected_segment_ids,
    affected_roads: h.affected_roads,
    official_warning_url: h.official_warning_url,
    water_depth_m: h.water_depth_m,
    is_demonstration: h.is_demonstration,
  };
}

export async function loadNetwork(base44, { district } = {}) {
  const segQuery = district && district !== "all" ? { district } : {};
  const hazQuery = district && district !== "all" ? { district } : {};

  const [placesRes, segRes, hazRes, shelterRes, alertRes, sourceRes] = await Promise.all([
    base44.entities.Place.list({ limit: 400 }),
    base44.entities.RoadSegment.filter(segQuery, { limit: 400 }),
    base44.entities.Hazard.filter(hazQuery, { limit: 300, sort: "-last_update" }),
    base44.entities.Shelter.list({ limit: 300 }),
    base44.entities.Alert.list({ limit: 60, sort: "-issued_at" }),
    base44.entities.DataSource.list({ limit: 60 }),
  ]);

  return {
    places: pageItems(placesRes),
    segments: pageItems(segRes),
    hazards: pageItems(hazRes),
    shelters: pageItems(shelterRes),
    alerts: pageItems(alertRes),
    sources: pageItems(sourceRes),
  };
}

/** Whole network regardless of district — routing must be able to cross districts. */
export async function loadFullNetwork(base44) {
  return loadNetwork(base44, { district: "all" });
}