import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, Play, TriangleAlert, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import FactorBreakdown from "@/components/explain/FactorBreakdown";
import ComparisonTable from "@/components/explain/ComparisonTable";
import WhatWouldChange from "@/components/explain/WhatWouldChange";
import RouteMap from "@/components/planner/RouteMap";
import RouteCards from "@/components/planner/RouteCards";
import { SeverityBadge, DataClassBadge, SourceLine } from "@/components/cc/Badges";
import { planJourney } from "@/lib/server-fns";
import { bandFor, BAND_LABEL, FACTOR_BY_KEY, DEFAULT_WEIGHTS } from "@/lib/risk";
import { fmtKm, fmtMinutes } from "@/lib/geo";
import { hazardLabel } from "@/lib/tn";
import { loadJourney, saveJourney } from "@/lib/journeyStore";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/explain")({
  head: () => ({
    meta: [
      { title: "Explainable AI — X-MADRL" },
      { name: "description", content: "Why a route was recommended, what changed the ranking, and what would change it." },
    ],
  }),
  component: ExplainPage,
});

const DEMO_ORIGIN = { label: "Chennai", lat: 13.0827, lng: 80.2707 };
const DEMO_DESTINATION = { label: "Madurai", lat: 9.9252, lng: 78.1198 };

function ExplainPage() {
  const { t, lang } = useLanguage();
  const planFn = useServerFn(planJourney);
  const [journey, setJourney] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [override, setOverride] = useState(null);

  useEffect(() => {
    const stored = loadJourney();
    if (stored) {
      setJourney(stored);
      setSelectedKey(stored.recommended_key);
    }
  }, []);

  const mutation = useMutation({
    mutationFn: (payload) => planFn({ data: payload }),
    onSuccess: (res) => {
      setJourney(res);
      setSelectedKey(res.recommended_key ?? res.candidates?.[0]?.key ?? null);
      setOverride(null);
      saveJourney(res);
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (payload) => planFn({ data: payload }),
    onSuccess: (res) => setOverride(res),
  });

  const runDemo = () => {
    mutation.mutate({
      origin: DEMO_ORIGIN,
      destination: DEMO_DESTINATION,
      mode: "driving",
      preferences: { ...{ pets: false, children: false, mobility_needs: false, max_walk_km: 6, destination_need: "any", priority: "balanced" } },
      weights: DEFAULT_WEIGHTS,
    });
  };

  const recommended = journey?.candidates?.find((c) => c.key === journey.recommended_key);
  const shortest = journey?.baselines?.shortest;
  const band = recommended ? bandFor(recommended.risk_score) : "unknown";
  const topFactors = recommended?.factors?.slice(0, 3) ?? [];

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("mod.explain.title")}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Every statement below is computed from the route that was actually ranked, on the data that was actually
            loaded.
          </p>
        </div>
        <Button size="sm" onClick={runDemo} disabled={mutation.isPending} className="gap-2">
          <Play className="h-3.5 w-3.5" />
          {journey ? "Recompute demonstration route" : "Compute a demonstration route"}
        </Button>
      </div>

      {mutation.isPending && (
        <p className="rounded-lg border border-border bg-surface-1/60 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
          Computing and explaining candidate routes…
        </p>
      )}

      {mutation.isError && (
        <p className="rounded-lg border border-risk-severe/40 bg-risk-severe/10 px-3 py-2 text-[12px] text-risk-severe">
          {String(mutation.error?.message ?? "The route could not be computed.").slice(0, 200)}
        </p>
      )}

      {!journey && !mutation.isPending && (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <BrainCircuit className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-[13px] font-semibold">Nothing to explain yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
            Plan a route in the Safe Route Planner, or compute a demonstration route here. The explanation panel then
            shows why the recommendation was selected and what would change it.
          </p>
        </div>
      )}

      {journey && !journey.ok && (
        <div className="rounded-xl border border-risk-severe/40 bg-risk-severe/10 p-4">
          <p className="flex items-start gap-2 text-[13px] font-semibold text-risk-severe">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {t("planner.noRoute")}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-risk-severe/90">{journey.message}</p>
        </div>
      )}

      {journey?.ok && (
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="space-y-3">
            <Panel title="Why this route was selected" icon={BrainCircuit} defaultOpen>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge level={band} />
                  <span className="chip">
                    {t("planner.score")} {recommended.risk_score.toFixed(2)}
                  </span>
                  <span className="chip">
                    {BAND_LABEL[band]?.[lang] ?? BAND_LABEL[band]?.en}
                  </span>
                </div>

                <p className="text-[12.5px] leading-relaxed">
                  {journey.origin_snap?.label} <ArrowRight className="inline h-3.5 w-3.5" /> {journey.destination_snap?.label} ·{" "}
                  {journey.mode} · {fmtKm(recommended.distance_km)} · {fmtMinutes(recommended.travel_time_min)}
                </p>

                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  This route has the lowest weighted cost of {journey.candidates.length} candidate
                  {journey.candidates.length === 1 ? "" : "s"} at a risk score of {recommended.risk_score.toFixed(2)}.
                  {topFactors.length > 0 &&
                    ` The factors that shaped it most are ${topFactors
                      .map((f) => `${FACTOR_BY_KEY[f.key]?.[lang] ?? f.key} (${Math.round(f.share * 100)}%)`)
                      .join(", ")}.`}
                </p>

                {shortest && (
                  <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                    <li>
                      · Compared with the shortest route:{" "}
                      <span className="text-foreground">
                        {recommended.distance_km - shortest.distance_km >= 0 ? "+" : ""}
                        {Number((recommended.distance_km - shortest.distance_km).toFixed(1))} km
                      </span>{" "}
                      and{" "}
                      <span className="text-foreground">
                        {recommended.travel_time_min - shortest.travel_time_min >= 0 ? "+" : ""}
                        {recommended.travel_time_min - shortest.travel_time_min} min
                      </span>
                      , with risk changing by{" "}
                      <span className="text-foreground">
                        {recommended.risk_score - shortest.risk_score >= 0 ? "+" : ""}
                        {Number((recommended.risk_score - shortest.risk_score).toFixed(2))}
                      </span>
                      .
                    </li>
                    <li>
                      · Hazards avoided versus the shortest route:{" "}
                      {shortest.hazards.filter((h) => !recommended.hazards.some((r) => r.id === h.id)).length}
                    </li>
                    <li>
                      · Hazards still encountered: {recommended.hazards.length}
                    </li>
                  </ul>
                )}

                <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="label-xs">Constraints with the greatest effect</p>
                  <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {topFactors.map((f) => (
                      <li key={f.key}>
                        · {FACTOR_BY_KEY[f.key]?.[lang] ?? f.key} — {Math.round(f.share * 100)}% of the total cost, weight{" "}
                        {f.weight.toFixed(2)}
                      </li>
                    ))}
                    {journey.network.hard_closed_removed > 0 && (
                      <li>
                        · {journey.network.hard_closed_removed} segment(s) removed from the graph by an authoritative,
                        fresh, confident confirmed closure
                      </li>
                    )}
                    {journey.preferences?.mobility_needs && <li>· mobility needs raised the weight of surface damage and uncertainty</li>}
                    {journey.preferences?.children && <li>· travelling with children raised the hazard weight</li>}
                    {journey.mode === "walking" && (
                      <li>· walking mode applies the maximum walking distance and refuses inundated segments</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="label-xs">Traffic and closure considerations</p>
                  <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    <li>
                      · Traffic information available on this route:{" "}
                      {recommended.traffic_supported ? "yes" : "no — no traffic-adjusted ETA is claimed"}
                    </li>
                    <li>
                      · Ordinary congestion segments: {recommended.traffic.ordinary.length} · disaster-related road danger
                      segments: {recommended.traffic.disaster_related.length}
                    </li>
                    <li>
                      · Closures or restrictions on the route: {recommended.closures.length}
                      {recommended.closures.length > 0
                        ? ` (${recommended.closures.map((c) => c.road_name + ": " + c.status.replace("_", " ")).join("; ")})`
                        : ""}
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="label-xs">Confidence and uncertainty</p>
                  <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    <li>
                      · Lowest segment confidence {recommended.uncertainty.min_confidence == null ? "not reported" : `${Math.round(recommended.uncertainty.min_confidence * 100)}%`} ·
                      average {recommended.uncertainty.avg_confidence == null ? "not reported" : `${Math.round(recommended.uncertainty.avg_confidence * 100)}%`}
                    </li>
                    <li>
                      · Evidence age: newest {recommended.uncertainty.newest_evidence_hours ?? "—"} h, oldest{" "}
                      {recommended.uncertainty.oldest_evidence_hours ?? "—"} h
                    </li>
                    <li>
                      · Segments with unknown traffic: {recommended.uncertainty.unknown_flags.traffic} · unknown surface
                      damage: {recommended.uncertainty.unknown_flags.damage} · unknown closure status:{" "}
                      {recommended.uncertainty.unknown_flags.closure}
                    </li>
                    <li>· Segments used: {recommended.uncertainty.segments}</li>
                  </ul>
                  <div className="mt-2">
                    <SourceLine source={(recommended.uncertainty.sources ?? []).join(", ")} extra={`segments drawn from: ${recommended.uncertainty.segments} edges`} />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Evidence used on this route" icon={Info} defaultOpen={false}>
              {recommended.hazards.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  No hazard in the loaded data names a segment on this route. That is an absence of records, not evidence
                  that the road is safe.
                </p>
              ) : (
                <ul className="space-y-3">
                  {recommended.hazards.map((h) => (
                    <li key={h.id ?? h.title} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge level={h.severity} />
                        <DataClassBadge value={h.data_class} />
                        <span className="text-[12.5px] font-medium">{h.title}</span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted-foreground">
                        {hazardLabel(h.hazard_type, lang)} · affects {h.affected_road}
                      </p>
                      <div className="mt-1">
                        <SourceLine source={h.source} updatedAt={h.last_update} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-3">
            <RouteMap
              journey={journey}
              selectedKey={selectedKey}
              className="overflow-hidden rounded-xl border border-border"
            />

            <RouteCards journey={journey} selectedKey={selectedKey} onSelect={setSelectedKey} />

            <Panel title="Why the alternatives ranked differently" icon={BrainCircuit} defaultOpen>
              {journey.versus ? (
                <ul className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  <li>
                    · {journey.versus.other_label} sits {journey.versus.risk_delta > 0 ? "above" : "below"} the
                    recommendation by {Math.abs(journey.versus.risk_delta).toFixed(2)} risk points.
                  </li>
                  <li>
                    · It is{" "}
                    {journey.versus.distance_delta_km >= 0 ? "longer" : "shorter"} by{" "}
                    {Math.abs(journey.versus.distance_delta_km)} km and{" "}
                    {journey.versus.time_delta_min >= 0 ? "slower" : "faster"} by{" "}
                    {Math.abs(journey.versus.time_delta_min)} min.
                  </li>
                  {journey.versus.biggest_factor_differences.map((d) => (
                    <li key={d.key}>
                      · Factor share difference on {FACTOR_BY_KEY[d.key]?.[lang] ?? d.key}:{" "}
                      {(d.delta * 100).toFixed(1)} percentage points
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  Only one viable route exists in this graph for the selected constraints, so there is no alternative
                  ranking to compare.
                </p>
              )}
              {journey.penalty_applied && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Alternatives are generated with a penalty method: segments used by an already-found route become more
                  expensive and the search repeats, so the alternatives are genuinely different corridors rather than
                  cosmetic variations.
                </p>
              )}
            </Panel>

            {recommended && (
              <Panel title={t("planner.compare")} defaultOpen>
                <ComparisonTable journey={journey} />
              </Panel>
            )}

            {recommended && (
              <Panel title="Factor breakdown" defaultOpen>
                <FactorBreakdown factors={recommended.factors} />
              </Panel>
            )}

            <Panel title="What would change this recommendation?" defaultOpen>
              <WhatWouldChange
                journey={journey}
                override={override}
                busy={overrideMutation.isPending}
                onClear={() => setOverride(null)}
                onRerun={(weights) =>
                  overrideMutation.mutate({
                    origin: journey.candidates[0].points[0],
                    destination: journey.candidates[0].points[journey.candidates[0].points.length - 1],
                    mode: journey.mode,
                    preferences: { ...journey.preferences, priority: "custom" },
                    weights,
                  })
                }
              />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}