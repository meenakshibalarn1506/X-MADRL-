export const TILE_SIZE = 256;
export const EARTH_R = 6371.0088;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function haversineKm(a, b) {
  const dLat = (b.lat - a.lat) * D2R;
  const dLng = (b.lng - a.lng) * D2R;
  const la1 = a.lat * D2R;
  const la2 = b.lat * D2R;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Web Mercator world pixel coordinates at a given integer zoom. */
export function worldPx(lat, lng, zoom, tile = TILE_SIZE) {
  const scale = tile * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin(clamp(lat, -85.05, 85.05) * D2R);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function fromWorldPx(x, y, zoom, tile = TILE_SIZE) {
  const scale = tile * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = R2D * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Ground resolution in metres per screen pixel. */
export function metersPerPixel(lat, zoom, tile = TILE_SIZE) {
  return (156543.03392 * Math.cos(clamp(lat, -85.05, 85.05) * D2R) * tile) / 256 / 2 ** zoom;
}

// Local equirectangular frame (km) — accurate enough at Tamil Nadu scale.
function toKm(p, lat0) {
  return { x: p.lng * 111.32 * Math.cos(lat0 * D2R), y: p.lat * 110.574 };
}

/** Distance in km from point p to segment a–b. */
export function pointToSegmentKm(p, a, b) {
  const lat0 = p.lat;
  const P = toKm(p, lat0);
  const A = toKm(a, lat0);
  const B = toKm(b, lat0);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(P.x - A.x, P.y - A.y);
  let t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = A.x + t * dx;
  const cy = A.y + t * dy;
  return Math.hypot(P.x - cx, P.y - cy);
}

export function pathLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineKm(points[i - 1], points[i]);
  return total;
}

export function midpoint(points) {
  if (!points || points.length === 0) return null;
  return points[Math.floor(points.length / 2)];
}

export function fmtKm(km) {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function fmtMinutes(min) {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${m} min`;
}

export function boundsOf(points) {
  if (!points || points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}