import {
  Satellite,
  SatelliteDish,
  TriangleAlert,
  CircleSlash,
  CircleHelp,
  Compass,
  Smartphone,
  Pause,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export const GPS_STATES = {
  available: { key: "gps.available", Icon: Satellite, className: "border-risk-low/40 bg-risk-low/10 text-risk-low" },
  degraded: { key: "gps.degraded", Icon: SatelliteDish, className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution" },
  stale: { key: "gps.stale", Icon: Activity, className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution" },
  unavailable: { key: "gps.unavailable", Icon: CircleSlash, className: "border-risk-severe/40 bg-risk-severe/10 text-risk-severe" },
  uncertain: { key: "gps.uncertain", Icon: CircleHelp, className: "border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated" },
};

function fmtTime(iso) {
  if (!iso) return "—";
  return String(iso).slice(11, 19);
}

/**
 * GPS status and uncertainty. The app never presents a precise position it does
 * not have: when the fix is old or inaccurate the panel says so, keeps the last
 * reliable fix, and shows the uncertainty radius instead.
 */
export default function GpsStatusPanel({
  status,
  fix,
  lastReliable,
  uncertaintyM,
  capability,
  onAcquire,
  onToggleWatch,
  watching,
  paused,
  fallbacks = [],
  confidence,
  manual,
}) {
  const { t } = useLanguage();
  const cfg = GPS_STATES[status] ?? GPS_STATES.uncertain;

  const confidenceLabel =
    confidence == null
      ? "Insufficient data"
      : confidence >= 70
        ? "High"
        : confidence >= 40
          ? "Moderate"
          : "Low";
  const confidenceTone =
    confidence == null
      ? "text-risk-unknown"
      : confidence >= 70
        ? "text-risk-low"
        : confidence >= 40
          ? "text-risk-caution"
          : "text-risk-severe";

  return (
    <div className="space-y-4">
      <div className={"rounded-xl border p-4 " + cfg.className}>
        <div className="flex items-start gap-3">
          <cfg.Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">{t(cfg.key)}</p>
            <p className="mt-1 text-[12px] leading-relaxed opacity-90">
              {status === "available" &&
                "A recent, accurate fix is available. Position is reported with its measured accuracy."}
              {status === "degraded" &&
                "A fix is available but its accuracy is poor. The position shown is an estimate with a wide uncertainty."}
              {status === "stale" &&
                "The last fix is older than the freshness window. The map is still showing that position, and turn-by-turn guidance is not trustworthy."}
              {status === "unavailable" &&
                "No position is available. Location permission may be denied, or the device cannot obtain a fix."}
              {status === "uncertain" &&
                "Position confidence is too low to report a precise location. An uncertainty region is shown instead."}
            </p>
          </div>
        </div>
      </div>

      {paused && (
        <div className="flex items-start gap-2 rounded-lg border border-risk-caution/40 bg-risk-caution/10 px-3 py-2.5 text-[12px] text-risk-caution">
          <Pause className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t("gps.paused")}. Guidance resumes automatically when a confident fix returns, or you can resume manually.
          </span>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <dt className="label-xs">{t("gps.uncertainty")}</dt>
          <dd className="mono mt-1">{uncertaintyM == null ? t("common.unknown") : `±${Math.round(uncertaintyM)} m`}</dd>
        </div>
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <dt className="label-xs">Fix age</dt>
          <dd className="mono mt-1">{fix?.ageSeconds == null ? t("common.unknown") : `${Math.round(fix.ageSeconds)} s`}</dd>
        </div>
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <dt className="label-xs">Live position</dt>
          <dd className="mono mt-1 text-[11px] leading-tight">
            {fix?.lat != null ? `${fix.lat.toFixed(4)}, ${fix.lng.toFixed(4)}` : t("common.unknown")}
          </dd>
          <dd className="mono mt-0.5 text-[10px] text-muted-foreground">
            {fix?.at ? `at ${fmtTime(fix.at)}` : "no fix acquired"}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <dt className="label-xs">{t("gps.lastFix")}</dt>
          <dd className="mono mt-1 text-[11px] leading-tight">
            {lastReliable?.lat != null
              ? `${lastReliable.lat.toFixed(4)}, ${lastReliable.lng.toFixed(4)}`
              : "No reliable previous fix"}
          </dd>
          <dd className="mono mt-0.5 text-[10px] text-muted-foreground">
            {lastReliable?.at ? `at ${fmtTime(lastReliable.at)} · ±${Math.round(lastReliable.accuracy ?? 0)} m` : "—"}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg border border-border bg-surface-1/60 p-3">
          <dt className="label-xs">Position confidence</dt>
          <dd className="mt-1 flex items-center gap-2">
            <span className={"text-[14px] font-semibold " + confidenceTone}>{confidenceLabel}</span>
            {confidence != null && <span className="mono text-[11px] text-muted-foreground">{confidence}%</span>}
          </dd>
          <dd className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            {confidence == null
              ? "No live fix, last-known fix or sensor data is available to estimate confidence."
              : "Based on reported accuracy, fix age and available sensors. A wider uncertainty radius lowers confidence."}
          </dd>
        </div>
        {manual && (
          <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/8 p-3">
            <dt className="label-xs text-primary">Manually selected position</dt>
            <dd className="mono mt-1 text-[12px]">{manual.lat.toFixed(4)}, {manual.lng.toFixed(4)}</dd>
            {manual.label && <dd className="mt-0.5 text-[10.5px] text-muted-foreground">{manual.label}</dd>}
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAcquire} className="gap-2">
          <Satellite className="h-3.5 w-3.5" />
          {t("gps.acquire")}
        </Button>
        <Button size="sm" variant={watching ? "secondary" : "outline"} onClick={onToggleWatch} className="gap-2">
          {watching ? "Stop live tracking" : "Track position live"}
        </Button>
      </div>

      <div>
        <p className="label-xs flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Positioning capability on this device
        </p>
        <ul className="mt-2 space-y-1.5 text-[12px]">
          {[
            { label: "Browser geolocation API", ok: capability?.geolocation },
            { label: "Device orientation (compass / heading)", ok: capability?.orientation },
            { label: "Device motion (step and movement sensing)", ok: capability?.motion },
            { label: "Permissions API for querying sensor consent", ok: capability?.permissions },
          ].map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={"mono text-[11px] " + (row.ok ? "text-risk-low" : "text-risk-unknown")}>
                {row.ok ? "available" : "not available"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {fallbacks.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-2/50 p-3">
          <p className="label-xs flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5" />
            Steps taken since positioning degraded
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {fallbacks.map((f, i) => (
              <li key={i}>· {f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-2/50 p-3">
        <p className="label-xs flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          What this app cannot promise
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          A browser cannot guarantee accurate navigation without GPS, network connectivity, cached maps or adequate
          alternative sensors. Map tiles are not cached on the device; only the last planned route and hazard snapshot
          are stored locally, and those are for orientation, not for turn-by-turn guidance.
        </p>
      </div>
    </div>
  );
}