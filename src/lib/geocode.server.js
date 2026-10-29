// Server-side geocoding proxy using OpenStreetMap Nominatim.
//
// Nominatim's usage policy requires a valid User-Agent, max 1 request/second,
// and result caching. This module runs on the server so it can set the proper
// headers, and it caches results in-memory to respect the rate limit.
// Results are supplemented by the app's bundled Tamil Nadu place index.

const CACHE = new Map();
const CACHE_TTL_MS = 3_600_000; // 1 hour

function classify(type, address) {
  const t = String(type || "").toLowerCase();
  if (t.includes("hospital")) return "hospital";
  if (t.includes("clinic")) return "hospital";
  if (t.includes("shelter") || t.includes("relief")) return "shelter";
  if (t.includes("police")) return "police_station";
  if (t.includes("fire")) return "fire_station";
  if (t.includes("city") || t.includes("town")) return "city";
  if (t.includes("village") || t.includes("hamlet")) return "town";
  if (t.includes("suburb") || t.includes("neighbourhood") || t.includes("locality")) return "landmark";
  if (t.includes("district")) return "district_hq";
  return "landmark";
}

function shortName(displayName) {
  if (!displayName) return "";
  const parts = displayName.split(",");
  return parts[0].trim();
}

function districtFrom(address) {
  if (!address) return null;
  return (
    address.county ||
    address.state_district ||
    address.city_district ||
    address.city ||
    address.town ||
    address.municipality ||
    address.state ||
    null
  );
}

/**
 * Geocode a free-text query against OpenStreetMap Nominatim.
 * Returns an array of { name, full_name, lat, lng, district, place_type, source }.
 * Throws on network failure so callers can fall back to the bundled index.
 */
export async function geocodeNominatim(query, { limit = 8 } = {}) {
  const key = query.toLowerCase().trim();
  if (!key) return [];

  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.results;

  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&addressdetails=1&limit=${limit}&countrycodes=in`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "X-MADRL/1.0 (disaster navigation platform for Tamil Nadu)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim responded ${res.status}`);
  }

  const data = await res.json();
  const results = (Array.isArray(data) ? data : []).map((r) => ({
    name: shortName(r.display_name),
    full_name: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    district: districtFrom(r.address),
    place_type: classify(r.type || r.class, r.address),
    source: "openstreetmap_nominatim",
    confidence: 0.8,
    is_demonstration: false,
  }));

  CACHE.set(key, { results, ts: Date.now() });
  return results;
}