import { Check, X, Route as RouteIcon, Waves, Clock, TriangleAlert } from "lucide-react";
import { SeverityBadge } from "@/components/cc/Badges";
import { bandFor, BAND_LABEL, FACTOR_BY_KEY } from "@/lib/risk";
import { fmtKm, fmtMinutes } from "@/lib/geo";
import { hazardLabel } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

export const ROUTE_COLOURS = {
  "route-a": "hsl(187 92% 52%)",
  "route-b": "hsl(27 92% 55%)",
  "route-c": "hsl(265 70% 62%)",
  "route-d": "hsl(330 75% 60%)",
};

function RouteCard({ route, colour, isRecommended, isSelected, onSelect, compare }) {
  const { t, lang } = useLanguage();
  const band = bandFor(route.risk_score);
  const topFactors = (route.factors ?? []).slice(0, 3);

  return (
    <button
      type="button"
      onClick={() => onSelect(route.key)}
      className={
        "w-full rounded-xl border p-4 text-left transition-colors " +
        (isSelected ? "border-primary/70 bg-primary/[0.07]" : "border-border bg-surface-1/60 hover:border-primary/40")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} aria-hidden="true" />
          <span className="truncate text-[13px] font-semibold">
            {isRecommended ? t("planner.recommended") : route.label}
          </span>
          {isRecommended && (
            <span className="chip border-primary/40 bg-primary/10 text-primary">
              <Check className="h-3 w-3" />
              {t("planner.score")} {route.risk_score.toFixed(2)}
            </span>
          )}
        </div>
        <SeverityBadge level={band} />
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{BAND_LABEL[band]?.[lang] ?? BAND_LABEL[band]?.en}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        <div>
          <dt className="label-xs">{t("common.distance")}</dt>
          <dd className="mono mt-0.5">{fmtKm(route.distance_km)}</dd>
        </div>
        <div>
          <dt className="label-xs">{t("common.time")}</dt>
          <dd className="mono mt-0.5">{fmtMinutes(route.travel_time_min)}</dd>
        </div>
        <div>
          <dt className="label-xs">{t("planner.trafficEta")}</dt>
          <dd className="mono mt-0.5">
            {route.traffic_supported ? fmtMinutes(route.traffic_adjusted_min) : t("common.unknown")}
          </dd>
        </div>
        <div>
          <dt className="label-xs">{t("planner.hazardsOnRoute")}</dt>
          <dd className="mono mt-0.5">{route.hazards.length}</dd>
        </div>
      </dl>

      {!route.traffic_supported && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Traffic information is not available on these segments, so no traffic-adjusted ETA is shown. This is not an
          ordinary-congestion estimate.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {route.closures.length > 0 && (
          <span className="chip border-risk-severe/40 bg-risk-severe/10 text-risk-severe">
            <X className="h-3 w-3" />
            {route.closures.length} closure{route.closures.length > 1 ? "s" : ""} on route
          </span>
        )}
        {route.steps.some((s) => (s.flood_exposure ?? 0) > 0.4) && (
          <span className="chip border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated">
            <Waves className="h-3 w-3" />
            flood exposure
          </span>
        )}
        {route.uncertainty.min_confidence != null && route.uncertainty.min_confidence < 0.6 && (
          <span className="chip border-risk-caution/40 bg-risk-caution/10 text-risk-caution">
            <TriangleAlert className="h-3 w-3" />
            confidence {Math.round(route.uncertainty.min_confidence * 100)}%
          </span>
        )}
        {route.uncertainty.oldest_evidence_hours != null && route.uncertainty.oldest_evidence_hours > 6 && (
          <span className="chip border-risk-caution/40 bg-risk-caution/10 text-risk-caution">
            <Clock className="h-3 w-3" />
            evidence {Math.round(route.uncertainty.oldest_evidence_hours)} h old
          </span>
        )}
      </div>

      {compare && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          {t("planner.compare")}: {compare.distance_km > 0 ? "+" : ""}
          {compare.distance_km} km · {compare.travel_time_min > 0 ? "+" : ""}
          {compare.travel_time_min} min · risk {compare.risk_score > 0 ? "+" : ""}
          {compare.risk_score.toFixed(2)}
        </p>
      )}

      {topFactors.length > 0 && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {t("planner.why")}:{" "}
          {topFactors
            .map((f) => `${FACTOR_BY_KEY[f.key]?.[lang] ?? FACTOR_BY_KEY[f.key]?.en} ${Math.round(f.share * 100)}%`)
            .join(" · ")}
        </p>
      )}

      {route.hazards.length > 0 && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {route.hazards
            .slice(0, 3)
            .map((h) => hazardLabel(h.hazard_type, lang))
            .join(" · ")}
          {route.hazards.length > 3 ? ` +${route.hazards.length - 3} more` : ""}
        </p>
      )}
    </button>
  );
}

export default function RouteCards({ journey, selectedKey, onSelect }) {
  const { t } = useLanguage();
  if (!journey) return null;

  const candidates = journey.candidates ?? [];
  const ranked = [...candidates].sort((a, b) => a.risk_score - b.risk_score);
  const shortest = journey.baselines?.shortest ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label-xs">{t("planner.alternatives")}</p>
        <span className="chip">{candidates.length} computed</span>
      </div>

      {!journey.ok && (
        <div className="rounded-xl border border-risk-severe/40 bg-risk-severe/10 p-4">
          <p className="flex items-start gap-2 text-[13px] font-semibold text-risk-severe">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {t("planner.noRoute")}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-risk-severe/90">{journey.message}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Follow the district administration, Tamil Nadu State Disaster Management Authority or police
            instructions, or contact emergency services. This app will not recommend an unsupported route.
          </p>
        </div>
      )}

      {ranked.map((route, i) =>
        route.suitable ? (
          <RouteCard
            key={route.key}
            route={route}
            colour={ROUTE_COLOURS[route.key] ?? "hsl(215 14% 58%)"}
            isRecommended={route.key === journey.recommended_key}
            isSelected={selectedKey === route.key}
            onSelect={onSelect}
            compare={
              shortest
                ? {
                    distance_km: Number((route.distance_km - shortest.distance_km).toFixed(1)),
                    travel_time_min: route.travel_time_min - shortest.travel_time_min,
                    risk_score: route.risk_score - shortest.risk_score,
                  }
                : null
            }
            index={i}
          />
        ) : null,
      )}

      {(journey.excluded ?? []).length > 0 && (
        <div className="rounded-xl border border-border bg-surface-1/60 p-4">
          <p className="label-xs">{t("planner.excluded")}</p>
          <ul className="mt-2.5 space-y-3">
            {journey.excluded.map((ex) => (
              <li key={ex.key} className="text-[12px]">
                <p className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="h-3.5 w-3.5 text-risk-elevated" />
                  {ex.label} · {fmtKm(ex.distance_km)} · {fmtMinutes(ex.travel_time_min)}
                </p>
                <ul className="mt-1 space-y-1 pl-5 text-muted-foreground">
                  {ex.reasons.map((r, i) => (
                    <li key={i}>· {r.text}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {journey.baselines?.shortest && (
        <div className="rounded-xl border border-border bg-surface-1/60 p-4">
          <p className="label-xs">Baselines for comparison</p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
            <li className="flex items-center gap-2">
              <RouteIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Shortest distance: {fmtKm(journey.baselines.shortest.distance_km)} ·{" "}
              {fmtMinutes(journey.baselines.shortest.travel_time_min)} · risk{" "}
              {journey.baselines.shortest.risk_score.toFixed(2)}
            </li>
            {journey.baselines.fastest && (
              <li className="flex items-center gap-2">
                <RouteIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Fastest: {fmtKm(journey.baselines.fastest.distance_km)} ·{" "}
                {fmtMinutes(journey.baselines.fastest.travel_time_min)} · risk{" "}
                {journey.baselines.fastest.risk_score.toFixed(2)}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}