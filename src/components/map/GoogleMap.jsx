import { useEffect, useRef } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { TN_CENTER } from "@/lib/tn";

// Dark navy map styles matching the X-MADRL command-centre aesthetic.
const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0b1426" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1426" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a6b8a" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#8b9dc3" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#a0b4d8" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#2a3a5c" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#5a6b8a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f1e2e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#162338" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#7a9ec8" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#162338" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1628" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d6a8e" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0b1426" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0d1828" }] },
];

const TONE_COLOR = {
  low: "#22c55e",
  caution: "#eab308",
  elevated: "#f97316",
  severe: "#ef4444",
  unknown: "#6b7280",
  primary: "#06b6d4",
};

function markerIcon(tone, selected) {
  const color = TONE_COLOR[tone] ?? TONE_COLOR.primary;
  const ring = selected ? `<circle cx="14" cy="14" r="13" fill="none" stroke="#06b6d4" stroke-width="2"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="9" fill="${color}" fill-opacity="0.9" stroke="#ffffff" stroke-width="2.5"/>${ring}</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(28, 28),
    anchor: new window.google.maps.Point(14, 14),
  };
}

/**
 * Child of <Map> that uses the underlying google.maps.Map instance to
 * sync pan/zoom with props, report view changes, and render markers,
 * polylines and circles imperatively.
 */
function MapContent({ center, zoom, markers, routes, circles, onViewChange, autoFit, highlightedPoints }) {
  const map = useMap();
  const markerRefs = useRef([]);
  const routeRefs = useRef([]);
  const circleRefs = useRef([]);
  const highlightRef = useRef(null);

  // Auto-fit to all route points when routes change (planner mode)
  useEffect(() => {
    if (!map || !autoFit) return;
    const google = window.google;
    if (!google) return;
    const allPoints = routes.flatMap((r) => r.points ?? []);
    if (allPoints.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of allPoints) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 60);
  }, [map, routes, autoFit]);

  // Pan when center prop changes (skip in autoFit mode — bounds take over)
  useEffect(() => {
    if (!map || autoFit) return;
    const c = map.getCenter();
    if (!c || Math.abs(c.lat() - center.lat) > 0.001 || Math.abs(c.lng() - center.lng) > 0.001) {
      map.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [map, center.lat, center.lng, autoFit]);

  // Zoom when zoom prop changes (skip in autoFit mode)
  useEffect(() => {
    if (!map || autoFit) return;
    if (map.getZoom() !== zoom) {
      map.setZoom(zoom);
    }
  }, [map, zoom, autoFit]);

  // Report view changes on idle so parent state stays in sync
  useEffect(() => {
    if (!map || !onViewChange) return undefined;
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      const z = map.getZoom();
      if (c && z != null) {
        onViewChange({ lat: c.lat(), lng: c.lng(), zoom: z });
      }
    });
    return () => listener.remove();
  }, [map, onViewChange]);

  // Markers
  useEffect(() => {
    if (!map) return undefined;
    const google = window.google;
    if (!google) return undefined;
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];
    for (const m of markers) {
      if (m.lat == null || m.lng == null) continue;
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        title: m.label || "",
        icon: markerIcon(m.tone, m.selected),
        zIndex: m.selected ? 999 : 1,
      });
      if (m.onClick) marker.addListener("click", () => m.onClick());
      markerRefs.current.push(marker);
    }
    return () => {
      markerRefs.current.forEach((m) => m.setMap(null));
      markerRefs.current = [];
    };
  }, [map, markers]);

  // Routes (polylines)
  useEffect(() => {
    if (!map) return undefined;
    const google = window.google;
    if (!google) return undefined;
    routeRefs.current.forEach((p) => p.setMap(null));
    routeRefs.current = [];
    for (const r of routes) {
      const path = (r.points ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
      if (path.length < 2) continue;
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: r.color || "#06b6d4",
        strokeOpacity: r.dimmed ? 0.45 : 0.95,
        strokeWeight: r.width || 4,
        map,
      });
      routeRefs.current.push(polyline);
    }
    return () => {
      routeRefs.current.forEach((p) => p.setMap(null));
      routeRefs.current = [];
    };
  }, [map, routes]);

  // Highlighted step segment (bright overlay polyline)
  useEffect(() => {
    if (!map) return undefined;
    const google = window.google;
    if (!google) return undefined;
    if (highlightRef.current) {
      highlightRef.current.setMap(null);
      highlightRef.current = null;
    }
    if (!highlightedPoints || highlightedPoints.length < 2) return undefined;
    highlightRef.current = new google.maps.Polyline({
      path: highlightedPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: "#06b6d4",
      strokeOpacity: 1.0,
      strokeWeight: 8,
      zIndex: 998,
      map,
    });
    return () => {
      if (highlightRef.current) {
        highlightRef.current.setMap(null);
        highlightRef.current = null;
      }
    };
  }, [map, highlightedPoints]);

  // Circles (hazard extents)
  useEffect(() => {
    if (!map) return undefined;
    const google = window.google;
    if (!google) return undefined;
    circleRefs.current.forEach((c) => c.setMap(null));
    circleRefs.current = [];
    for (const c of circles) {
      if (c.lat == null || c.lng == null) continue;
      const circle = new google.maps.Circle({
        center: { lat: c.lat, lng: c.lng },
        radius: (c.radiusKm ?? 1) * 1000,
        fillColor: c.fill || "#f97316",
        fillOpacity: 0.15,
        strokeColor: c.stroke || "#f97316",
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        strokeDasharray: "4 4",
        map,
      });
      circleRefs.current.push(circle);
    }
    return () => {
      circleRefs.current.forEach((c) => c.setMap(null));
      circleRefs.current = [];
    };
  }, [map, circles]);

  return null;
}

/**
 * Google Maps renderer with the same props interface as TileMap.
 * Uses @vis.gl/react-google-maps APIProvider + Map per the Google Maps
 * Platform React 101 codelab. Dark-styled to match the dashboard.
 * When autoFit is true, the map fits its bounds to all route points
 * and ignores center/zoom sync (planner mode).
 */
export default function GoogleMap({
  center = TN_CENTER,
  zoom = 7,
  markers = [],
  routes = [],
  circles = [],
  places = [],
  onMapClick,
  onViewChange,
  className = "",
  apiKey,
  showControls = true,
  interactive = true,
  ariaLabel = "Tamil Nadu map",
  autoFit = false,
  highlightedPoints = null,
}) {
  return (
    <div className={className} aria-label={ariaLabel}>
      <APIProvider apiKey={apiKey} region="IN">
        <Map
          defaultCenter={{ lat: center.lat, lng: center.lng }}
          defaultZoom={zoom}
          styles={DARK_MAP_STYLES}
          disableDefaultUI={!showControls}
          zoomControl={showControls}
          mapTypeControl={showControls}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={false}
          gestureHandling={interactive ? "greedy" : "none"}
          className="h-full w-full"
          onClick={(e) => {
            if (onMapClick && e.detail.latLng) {
              onMapClick({ lat: e.detail.latLng.lat(), lng: e.detail.latLng.lng() });
            }
          }}
        >
          <MapContent
            center={center}
            zoom={zoom}
            markers={markers}
            routes={routes}
            circles={circles}
            onViewChange={onViewChange}
            autoFit={autoFit}
            highlightedPoints={highlightedPoints}
          />
        </Map>
      </APIProvider>
    </div>
  );
}