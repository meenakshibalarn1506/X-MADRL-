import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Compass, Download, Route as RouteIcon, Info, Trash2, LifeBuoy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import SmartMap from "@/components/map/SmartMap";
import GpsStatusPanel from "@/components/gps/GpsStatusPanel";
import PositionSimulator from "@/components/gps/PositionSimulator";
import ManualPositionPanel from "@/components/gps/ManualPositionPanel";
import RescueBeacon from "@/components/gps/RescueBeacon";
import { getSimulationNetwork, saveSimulationRun } from "@/lib/server-fns";
import { loadJourney, loadOfflineSnapshot, saveOfflineSnapshot, clearOfflineSnapshot } from "@/lib/journeyStore";
import { haversineKm } from "@/lib/geo";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/gps")({
  head: () => ({
    meta: [
      { title: "GPS-Denied Navigation — X-MADRL" },
      { name: "description", content: "Position uncertainty tracking, fallback positioning and a labelling-honest simulation mode." },
    ],
  }),
  component: GpsPage,
});

const FRESH_FIX_SECONDS = 30;
const STALE_FIX_SECONDS = 120;
const GOOD_ACCURACY_M = 50;
const POOR_ACCURACY_M = 150;

function deriveStatus({ fix, error }) {
  if (error && !fix) return "unavailable";
  if (!fix) return "uncertain";
  if (fix.ageSeconds > STALE_FIX_SECONDS) return "stale";
  if (fix.accuracy != null && fix.accuracy > POOR_ACCURACY_M) return "uncertain";
  if (fix.accuracy != null && fix.accuracy > GOOD_ACCURACY_M) return "degraded";
  return "available";
}

function computeConfidence({ fix, lastReliable, capability }) {
  const hasFix = fix && fix.ageSeconds <= STALE_FIX_SECONDS;
  const hasLast = lastReliable != null;

  if (!hasFix && !hasLast) return null;

  let base = 0;
  let source = "";

  if (hasFix) {
    source = "live";
    const acc = fix.accuracy;
    if (acc != null && acc <= GOOD_ACCURACY_M) base = 80;
    else if (acc != null && acc <= POOR_ACCURACY_M) base = 50;
    else if (acc != null) base = 25;
    else base = 35;

    if (fix.ageSeconds > FRESH_FIX_SECONDS) base -= 15;
    if (fix.ageSeconds > STALE_FIX_SECONDS) base -= 25;
  } else if (hasLast) {
    source = "last_known";
    base = 30;
  }

  if (capability?.orientation) base += 5;
  if (capability?.motion) base += 5;

  return Math.max(0, Math.min(100, Math.round(base)));
}

function GpsPage() {
  const { t } = useLanguage();
  const networkFn = useServerFn(getSimulationNetwork);
  const saveRunFn = useServerFn(saveSimulationRun);

  const [fix, setFix] = useState(null);
  const [lastReliable, setLastReliable] = useState(null);
  const [error, setError] = useState(null);
  const [watching, setWatching] = useState(false);
  const [heading, setHeading] = useState(null);
  const [steps, setSteps] = useState(0);
  const [fallbacks, setFallbacks] = useState([]);
  const [now, setNow] = useState(0);
  const [offline, setOffline] = useState(null);
  const [plannedJourney, setPlannedJourney] = useState(null);
  const [savedNote, setSavedNote] = useState(null);
  const [manual, setManual] = useState(null);
  const [selectingOnMap, setSelectingOnMap] = useState(false);
  const watchIdRef = useRef(null);

  const networkQuery = useQuery({
    queryKey: ["sim-network"],
    queryFn: () => networkFn({}),
  });

  useEffect(() => {
    setOffline(loadOfflineSnapshot());
    setPlannedJourney(loadJourney());
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // No automatic geolocation request on mount. The map starts on a neutral
  // Tamil Nadu view. Position is only acquired when the user clicks the button.

  const capability = useMemo(
    () => ({
      geolocation: typeof navigator !== "undefined" && Boolean(navigator.geolocation),
      orientation: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
      motion: typeof window !== "undefined" && "DeviceMotionEvent" in window,
      permissions: typeof navigator !== "undefined" && Boolean(navigator.permissions),
    }),
    [],
  );

  const note = useCallback((text) => {
    setFallbacks((list) => (list.includes(text) ? list : [...list, text]));
  }, []);

  const acceptPosition = useCallback(
    (pos) => {
      const next = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        at: new Date().toISOString(),
        ageSeconds: 0,
      };
      setFix((prev) => {
        if (prev) note("Previous fix replaced by a newer one.");
        return next;
      });
      if (next.accuracy != null && next.accuracy <= GOOD_ACCURACY_M) {
        setLastReliable({ lat: next.lat, lng: next.lng, accuracy: next.accuracy, at: next.at });
      }
      setError(null);
    },
    [note],
  );

  const acquire = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This device does not expose a location sensor to the browser.");
      note("No geolocation API on this device, so no fix can be obtained.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      acceptPosition,
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "No position could be determined.");
        note(
          err.code === err.PERMISSION_DENIED
            ? "Permission denied: the map and saved route stay usable, but no live position is available."
            : "The device could not obtain a fix from any source.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }, [acceptPosition, note]);

  const toggleWatch = useCallback(() => {
    if (watching) {
      if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
      note("Live tracking stopped at your request.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This device does not expose a location sensor to the browser.");
      return;
    }
    setWatching(true);
    note("Live tracking started. Fixes are used in memory only and are not stored as location history.");
    watchIdRef.current = navigator.geolocation.watchPosition(acceptPosition, (err) => {
      setError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "The position became unavailable.");
      note("The position stream stopped; the last reliable fix is being held.");
    }, { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 });
  }, [watching, acceptPosition, note]);

  useEffect(() => {
    if (!watching) return undefined;
    const onOrient = (e) => {
      if (typeof e.alpha === "number") {
        setHeading(e.alpha);
        note("Compass heading is being used to orient the estimate while the fix is poor.");
      }
    };
    let lastStep = 0;
    const onMotion = (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      if (magnitude > 12.5 && now - lastStep > 400) {
        lastStep = now;
        setSteps((s) => s + 1);
        note("Device motion is being used to count steps, which only refines distance travelled — not absolute position.");
      }
    };
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [watching, now, note]);

  useEffect(
    () => () => {
      if (watchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    },
    [],
  );

  const liveFix = fix ? { ...fix, ageSeconds: now ? Math.max(0, (now - Date.parse(fix.at)) / 1000) : 0 } : null;
  const status = deriveStatus({ fix: liveFix, error });
  const uncertaintyM = liveFix?.accuracy ?? (status === "unavailable" ? null : lastReliable ? lastReliable.accuracy * 3 : null);
  const paused = status === "stale" || status === "unavailable" || status === "uncertain";
  const confidence = computeConfidence({ fix: liveFix, lastReliable, capability });

  const routePoints = plannedJourney?.candidates?.find((c) => c.key === plannedJourney.recommended_key)?.points ?? [];
  const distanceToRoute = useMemo(() => {
    if (!liveFix || routePoints.length === 0 || paused) return null;
    return Math.min(...routePoints.map((p) => haversineKm(liveFix, p)));
  }, [liveFix, routePoints, paused]);

  const handleMapClick = useCallback(
    (point) => {
      if (selectingOnMap) {
        setManual({ lat: point.lat, lng: point.lng, at: new Date().toISOString(), label: null });
        setSelectingOnMap(false);
        note("Manual position set by map click. This is not a GPS fix.");
      }
    },
    [selectingOnMap, note],
  );

  const markers = [];
  if (liveFix) {
    markers.push({ id: "live", lat: liveFix.lat, lng: liveFix.lng, tone: paused ? "caution" : "primary", label: paused ? "estimate" : "your position", pulse: !paused });
  }
  if (lastReliable && paused) {
    markers.push({ id: "last", lat: lastReliable.lat, lng: lastReliable.lng, tone: "low", label: "last reliable fix" });
  }
  if (manual) {
    markers.push({ id: "manual", lat: manual.lat, lng: manual.lng, tone: "caution", label: "manual", selected: true });
  }
  const circles = [];
  if (liveFix && uncertaintyM) {
    circles.push({
      id: "uncertainty",
      lat: liveFix.lat,
      lng: liveFix.lng,
      radiusKm: uncertaintyM / 1000,
      className: paused ? "text-risk-elevated/20" : "text-primary/20",
      strokeClassName: paused ? "stroke-risk-elevated/70" : "stroke-primary/70",
    });
  }

  // Neutral default view: Tamil Nadu centre, not the user's location.
  const centre = liveFix ?? manual ?? lastReliable ?? { lat: 10.85, lng: 78.55 };
  const zoom = liveFix ? 13 : manual || lastReliable ? 12 : 7;

  const saveRun = (payload) => {
    saveRunFn({ data: payload })
      .then(() => setSavedNote("Evaluation run saved to the history."))
      .catch((err) => setSavedNote("The run could not be saved: " + (err?.message ?? "unknown error")));
  };

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[400px_1fr]">
      <div className="space-y-3">
        <Panel title="Positioning status" subtitle="Uncertainty is tracked, never hidden" icon={Compass} defaultOpen>
          <GpsStatusPanel
            status={status}
            fix={liveFix}
            lastReliable={lastReliable}
            uncertaintyM={uncertaintyM}
            capability={capability}
            onAcquire={acquire}
            onToggleWatch={toggleWatch}
            watching={watching}
            paused={paused}
            fallbacks={fallbacks}
            confidence={confidence}
            manual={manual}
          />
          <p className="mono mt-3 text-[11px] text-muted-foreground">
            heading: {heading == null ? "not available" : `${Math.round(heading)}°`} · steps counted: {steps}
          </p>
        </Panel>

        <Panel title="Set position on map" subtitle="GPS-independent fallback" icon={MapPin} defaultOpen>
          <ManualPositionPanel
            manual={manual}
            onMapSelectMode={() => setSelectingOnMap((s) => !s)}
            onClear={() => { setManual(null); note("Manual position cleared."); }}
            onPlaceSelect={(p) => {
              setManual({ ...p, at: new Date().toISOString() });
              note(`Manual position set to "${p.label}" via place search.`);
            }}
          />
          {selectingOnMap && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[12px] text-primary">
              <MapPin className="h-3.5 w-3.5" />
              Click the map to drop a manual position pin.
            </p>
          )}
        </Panel>

        <Panel title="Rescue beacon" subtitle="Private, consent-based position sharing" icon={LifeBuoy} defaultOpen>
          <RescueBeacon
            position={liveFix}
            lastReliable={lastReliable}
            positionSourceLabel={manual ? "manual" : liveFix ? "gps" : "none"}
          />
        </Panel>

        <Panel title="Offline readiness" icon={Download} defaultOpen={false}>
          {offline ? (
            <>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                A route and hazard snapshot is stored on this device from{" "}
                {String(offline.at).slice(0, 16).replace("T", " ")}.
              </p>
              <ul className="mono mt-2 space-y-1 text-[11px] text-muted-foreground">
                <li>origin: {offline.snapshot?.origin?.label ?? "—"}</li>
                <li>destination: {offline.snapshot?.destination?.label ?? "—"}</li>
                <li>recommended distance: {offline.snapshot?.distance_km ?? "—"} km</li>
                <li>hazards captured: {offline.snapshot?.hazard_count ?? 0}</li>
              </ul>
              {offline.snapshot?.steps?.length > 0 && (
                <div className="mt-3">
                  <p className="label-xs">{t("gps.offline")}</p>
                  <ol className="mt-2 space-y-1.5 text-[11.5px] text-muted-foreground">
                    {offline.snapshot.steps.slice(0, 12).map((s, i) => (
                      <li key={i}>
                        {i + 1}. {s.road_name} — {s.from} to {s.to} ({s.distance_km} km)
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => { clearOfflineSnapshot(); setOffline(null); }}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete the local snapshot
              </Button>
            </>
          ) : (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Nothing is stored offline yet. Open the Safe Route Planner, plan a route, and use “Store for offline use”.
              Map tiles are never cached by this app, so the map itself may not render without a connection.
            </p>
          )}
        </Panel>

        {plannedJourney && (
          <Panel title="Guidance relative to your planned route" icon={RouteIcon} defaultOpen={false}>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {paused
                ? "Recalculation is paused: the position estimate is too uncertain to say where you are relative to the route, so the app will not report progress rather than reporting a wrong one."
                : distanceToRoute == null
                  ? "No live position is available, so progress along the route cannot be computed."
                  : `You are approximately ${distanceToRoute.toFixed(2)} km from the planned route.`}
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Turning this into spoken turn-by-turn guidance would need a live positioning service; this build does not
              claim to provide one.
            </p>
          </Panel>
        )}
      </div>

      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <SmartMap
            center={centre}
            zoom={zoom}
            markers={markers}
            circles={circles}
            onMapClick={handleMapClick}
            className={"h-[46vh] w-full rounded-none border-0 " + (selectingOnMap ? "ring-2 ring-primary" : "")}
            ariaLabel="Position and uncertainty map"
          />
        </div>
        {selectingOnMap && (
          <p className="-mt-1 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[12px] text-primary">
            <MapPin className="h-3.5 w-3.5" />
            Map click mode active — click anywhere on the map to set a manual position.
          </p>
        )}

        <Panel title={t("gps.simulation")} icon={Compass} defaultOpen={false}>
          {networkQuery.isLoading ? (
            <p className="text-[12.5px] text-muted-foreground">Loading the road graph for simulation…</p>
          ) : networkQuery.isError ? (
            <p className="text-[12.5px] text-risk-severe">
              The road graph could not be loaded: {String(networkQuery.error?.message ?? "").slice(0, 120)}
            </p>
          ) : (
            <>
              <PositionSimulator segments={networkQuery.data?.segments ?? []} onSaveRun={saveRun} busy={false} />
              {savedNote && <p className="mt-3 text-[11.5px] text-muted-foreground">{savedNote}</p>}
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The road graph used here contains {networkQuery.data?.segments?.length ?? 0} segments and is the same
                demonstration network the router uses.
              </p>
            </>
          )}
        </Panel>

        {plannedJourney && routePoints.length > 0 && (
          <Panel title="Store this route for offline use" defaultOpen={false}>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                const rec = plannedJourney.candidates.find((c) => c.key === plannedJourney.recommended_key);
                saveOfflineSnapshot({
                  origin: { label: plannedJourney.origin_snap?.label },
                  destination: { label: plannedJourney.destination_snap?.label },
                  distance_km: rec?.distance_km,
                  hazard_count: rec?.hazards?.length ?? 0,
                  steps: rec?.steps ?? [],
                });
                setOffline(loadOfflineSnapshot());
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Store route and hazard snapshot locally
            </Button>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Stored on this device only. It is orientation material if connectivity drops, and it is cleared when you
              delete it or clear this browser’s storage.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}