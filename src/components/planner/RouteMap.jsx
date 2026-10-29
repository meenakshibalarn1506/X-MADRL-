import { MapPin, Navigation } from "lucide-react";
import SmartMap from "@/components/map/SmartMap";
import { ROUTE_COLOURS } from "@/components/planner/RouteCards";
import { TN_CENTER, hazardLabel } from "@/lib/tn";
import { fmtKm, fmtMinutes } from "@/lib/geo";
import { useLanguage } from "@/lib/i18n";

/**
 * Route display. The recommended route is drawn thick and solid; alternatives
 * are thinner and dimmed and are labelled on the cards, so the line colour is
 * never the only thing identifying a route.
 *
 * When autoFit is true the map fits its bounds to all route points.
 * highlightedPoints renders a bright overlay segment (selected navigation step).
 */
export default function RouteMap({ journey, selectedKey, className = "", markers = [], onMapClick, autoFit, highlightedPoints }) {
  const { lang } = useLanguage();

  const candidates = journey?.candidates ?? [];
  const routes = [];
  for (const c of candidates) {
    const isSelected = c.key === selectedKey;
    const isRecommended = c.key === journey?.recommended_key;
    routes.push({
      id: c.key,
      points: c.points,
      color: ROUTE_COLOURS[c.key] ?? "hsl(215 14% 58%)",
      width: isSelected ? 6 : isRecommended ? 5 : 3,
      dimmed: !isSelected && !isRecommended,
    });
  }
  if (journey?.baselines?.shortest && !candidates.some((c) => c.key === "baseline-shortest")) {
    routes.push({
      id: "baseline-shortest",
      points: journey.baselines.shortest.points,
      color: "hsl(215 14% 58%)",
      width: 2,
      dimmed: true,
      dashed: true,
    });
  }

  const hazardCircles = [];
  const seen = new Set();
  for (const c of candidates) {
    for (const h of c.hazards ?? []) {
      if (seen.has(h.id ?? h.title)) continue;
      seen.add(h.id ?? h.title);
      hazardCircles.push({
        id: h.id ?? h.title,
        lat: h.lat ?? candidates[0]?.points?.[0]?.lat,
        lng: h.lng ?? candidates[0]?.points?.[0]?.lng,
        radiusKm: 2,
        fill: "currentColor",
        className: h.severity === "severe" ? "text-risk-severe/15" : h.severity === "elevated" ? "text-risk-elevated/15" : "text-risk-caution/15",
        strokeClassName: h.severity === "severe" ? "stroke-risk-severe/50" : h.severity === "elevated" ? "stroke-risk-elevated/50" : "stroke-risk-caution/50",
      });
    }
  }

  const routeMarkers = [];
  if (journey?.origin_snap) {
    const first = candidates[0]?.points?.[0];
    if (first) routeMarkers.push({ id: "origin", lat: first.lat, lng: first.lng, tone: "primary", label: journey.origin_snap.label, Icon: Navigation });
  }
  if (journey?.destination_snap && candidates[0]?.points?.length) {
    const last = candidates[0].points[candidates[0].points.length - 1];
    routeMarkers.push({ id: "destination", lat: last.lat, lng: last.lng, tone: "low", label: journey.destination_snap.label, Icon: MapPin });
  }

  const recommended = candidates.find((c) => c.key === journey?.recommended_key) ?? candidates[0];
  const focus = (candidates.find((c) => c.key === selectedKey)?.points ?? candidates[0]?.points) ?? [];
  const centre = focus.length ? focus[Math.floor(focus.length / 2)] : TN_CENTER;

  return (
    <div className={"relative " + className}>
      <SmartMap
        center={{ lat: centre.lat, lng: centre.lng }}
        zoom={focus.length > 2 ? 8 : 7}
        routes={routes}
        circles={hazardCircles}
        markers={[...routeMarkers, ...markers]}
        places={[]}
        onMapClick={onMapClick}
        autoFit={autoFit}
        highlightedPoints={highlightedPoints}
        className="h-full w-full"
        ariaLabel="Route comparison map"
      />

      {journey && recommended && (
        <div className="absolute left-3 top-3 z-30 rounded-lg border border-border bg-background/90 px-3 py-2 backdrop-blur">
          <p className="text-[12px] font-semibold">{fmtKm(recommended.distance_km)}</p>
          <p className="mono text-[10.5px] text-muted-foreground">{fmtMinutes(recommended.travel_time_min)}</p>
        </div>
      )}

      {journey && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-surface-1/60 px-3 py-2">
          {candidates.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="inline-block h-1 w-5 rounded-full"
                style={{ background: ROUTE_COLOURS[c.key] ?? "hsl(215 14% 58%)" }}
                aria-hidden="true"
              />
              {c.key === journey.recommended_key ? "Recommended" : c.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-1 w-5 rounded-full border-t-2 border-dashed border-risk-unknown" aria-hidden="true" />
            Shortest distance
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground">
            hazards on route: {(journey.candidates.find((c) => c.key === journey.recommended_key)?.hazards ?? []).length > 0
              ? journey.candidates
                  .find((c) => c.key === journey.recommended_key)
                  .hazards.map((h) => hazardLabel(h.hazard_type, lang))
                  .slice(0, 3)
                  .join(", ")
              : "none reported"}
          </span>
        </div>
      )}
    </div>
  );
}