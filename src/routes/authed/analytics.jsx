import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { RefreshCw, TrendingUp, Info, Activity, Database, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import StatCard from "@/components/cc/StatCard";
import DistrictSelect from "@/components/controls/DistrictSelect";
import { getAnalyticsSummary } from "@/lib/server-fns";
import { HAZARD_TYPES, TN_DISTRICTS, districtLabel, hazardLabel } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/analytics")({
  head: () => ({
    meta: [
      { title: "Disaster Analytics — X-MADRL" },
      { name: "description", content: "Hazard, reporting and routing trends across Tamil Nadu districts." },
    ],
  }),
  component: AnalyticsPage,
});

const SEVERITY_COLOUR = {
  low: "hsl(var(--risk-low))",
  caution: "hsl(var(--risk-caution))",
  elevated: "hsl(var(--risk-elevated))",
  severe: "hsl(var(--risk-severe))",
};

const DATA_CLASS_COLOUR = {
  observed: "hsl(var(--risk-low))",
  official: "hsl(var(--primary))",
  forecast: "hsl(var(--risk-caution))",
  historical: "hsl(var(--chart-5))",
  simulated: "hsl(var(--risk-unknown))",
};

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function EmptyChart({ label }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-center">
      <p className="max-w-xs text-[12px] text-muted-foreground">
        {label || "No data available for this view."}
      </p>
    </div>
  );
}

function AnalyticsPage() {
  const { t, lang } = useLanguage();
  const fn = useServerFn(getAnalyticsSummary);
  const [district, setDistrict] = useState("all");
  const [hazardType, setHazardType] = useState("all");

  const query = useQuery({
    queryKey: ["analytics", district, hazardType],
    queryFn: () => fn({ data: { district, hazard_types: hazardType !== "all" ? [hazardType] : undefined } }),
  });

  const data = query.data;

  const byType = (data?.hazards_by_type ?? []).map((r) => ({
    name: hazardLabel(r.hazard_type, lang),
    count: r.count,
  }));

  const byDistrict = (data?.hazards_by_district ?? [])
    .map((r) => ({ name: districtLabel(r.district, lang), count: r.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const bySeverity = (data?.hazards_by_severity ?? []).map((r) => ({
    name: r.severity,
    value: r.count,
    fill: SEVERITY_COLOUR[r.severity] ?? "hsl(var(--risk-unknown))",
  }));

  const byClass = (data?.hazards_by_data_class ?? []).map((r) => ({
    name: r.data_class,
    value: r.count,
    fill: DATA_CLASS_COLOUR[r.data_class] ?? "hsl(var(--risk-unknown))",
  }));

  const trendLabel = (r) => {
    const d = r.created_date ?? r.date ?? r._id ?? "";
    return String(d).slice(5, 10);
  };

  const hazardTrend = (data?.hazards_trend ?? []).map((r) => ({
    name: trendLabel(r),
    count: r.count,
  }));

  const alertTrend = (data?.alerts_trend ?? []).map((r) => ({
    name: trendLabel(r),
    count: r.count,
  }));

  const alertSeverity = (data?.alerts_by_severity ?? []).map((r) => ({
    name: r.severity,
    value: r.count,
    fill: SEVERITY_COLOUR[r.severity] ?? "hsl(var(--risk-unknown))",
  }));

  const coverage = new Set((data?.hazards_by_district ?? []).map((r) => r.district)).size;
  const sourceFreshness = data?.source_freshness ?? { connected: 0, stale: 0, total: 0 };

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("mod.analytics.title")}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Aggregated on the server from the hazard, report, routing and evaluation records. Demonstrations are counted
            separately from observations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[180px]">
            <DistrictSelect value={district} onChange={setDistrict} />
          </div>
          <select
            value={hazardType}
            onChange={(e) => setHazardType(e.target.value)}
            className="h-9 rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          >
            <option value="all">All hazard types</option>
            {HAZARD_TYPES.map((h) => (
              <option key={h.key} value={h.key}>
                {lang === "ta" ? h.ta : h.en}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={"h-3.5 w-3.5 " + (query.isFetching ? "animate-spin" : "")} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <p className="rounded-lg border border-border bg-surface-1/60 px-3 py-6 text-center text-[12.5px] text-muted-foreground">
          Aggregating records…
        </p>
      ) : query.isError ? (
        <p className="rounded-lg border border-risk-severe/40 bg-risk-severe/10 px-3 py-2 text-[12px] text-risk-severe">
          Analytics could not be computed: {String(query.error?.message ?? "").slice(0, 200)}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Hazard records" value={data?.hazard_total ?? 0} tone="severe" hint="all classes, all statuses" />
            <StatCard label="Districts covered" value={`${coverage} / ${TN_DISTRICTS.length}`} tone="caution" hint="empty districts are not monitored" />
            <StatCard label="Verification rate" value={`${data?.verification_rate ?? 0}%`} tone="low" hint={`${data?.total_reports ?? 0} community reports`} />
            <StatCard label="Alert records" value={data?.alert_total ?? 0} tone="primary" hint="all severities" />
            <StatCard label="Sources connected" value={`${sourceFreshness.connected}/${sourceFreshness.total}`} tone="muted" hint={`${sourceFreshness.stale} stale (>24h)`} />
          </div>

          {/* Hazard trend + Alert trend */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Hazard records over time" icon={TrendingUp} defaultOpen>
              {hazardTrend.length === 0 ? (
                <EmptyChart label="No hazard records have a creation date, so no trend is available yet." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hazardTrend} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Hazards" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Alert history" icon={Bell} defaultOpen>
              {alertTrend.length === 0 ? (
                <EmptyChart label="No alert records have an issue date, so no alert trend is available yet." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={alertTrend} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} name="Alerts" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* Hazard by type + Districts */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Hazards by category" icon={Activity} defaultOpen>
              {byType.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byType} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.4)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="name" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Districts with the most records" icon={TrendingUp} defaultOpen>
              {byDistrict.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDistrict} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-30} height={60} textAnchor="end" />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* Severity + Data class */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Severity mix" defaultOpen>
              {bySeverity.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bySeverity} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2}>
                        {bySeverity.map((s) => (
                          <Cell key={s.name} fill={s.fill} stroke="hsl(var(--background))" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <ul className="mt-2 flex flex-wrap gap-2">
                {bySeverity.map((s) => (
                  <li key={s.name} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.fill }} />
                    {s.name} ({s.value})
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Data class mix" defaultOpen>
              {byClass.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byClass} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2}>
                        {byClass.map((s) => (
                          <Cell key={s.name} fill={s.fill} stroke="hsl(var(--background))" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <ul className="mt-2 flex flex-wrap gap-2">
                {byClass.map((s) => (
                  <li key={s.name} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.fill }} />
                    {s.name} ({s.value})
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                A large simulated share is expected in this build: the demonstration records are counted honestly rather
                than hidden inside the totals.
              </p>
            </Panel>
          </div>

          {/* Alert severity + Source freshness */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Alerts by severity" defaultOpen>
              {alertSeverity.length === 0 ? (
                <EmptyChart label="No alert records found." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={alertSeverity} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {alertSeverity.map((s) => (
                          <Cell key={s.name} fill={s.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Data-source freshness" icon={Database} defaultOpen>
              {(data?.sources ?? []).length === 0 ? (
                <EmptyChart label="No data sources registered." />
              ) : (
                <ul className="space-y-2 text-[12px]">
                  {(data.sources ?? []).slice(0, 10).map((s) => (
                    <li key={s.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                      <span className="min-w-0">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="mono ml-2 text-[10.5px] text-muted-foreground">
                          {s.staleness_hours != null ? `${s.staleness_hours}h ago` : "never"}
                        </span>
                      </span>
                      <span
                        className={
                          "chip " +
                          (s.access_status === "connected"
                            ? "border-risk-low/40 bg-risk-low/10 text-risk-low"
                            : s.staleness_hours != null && s.staleness_hours > 24
                              ? "border-risk-severe/40 bg-risk-severe/10 text-risk-severe"
                              : "border-border text-muted-foreground")
                        }
                      >
                        {s.access_status?.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Community reports by status + Verification rate */}
          <Panel title="Community reports by status" defaultOpen={false}>
            {(data?.reports_by_status ?? []).length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">No community reports recorded yet.</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-risk-low">{data?.verification_rate ?? 0}%</span>
                  <span className="text-[11.5px] text-muted-foreground">verification rate across {data?.total_reports ?? 0} reports</span>
                </div>
                <ul className="space-y-2 text-[12.5px]">
                  {(data.reports_by_status ?? []).map((r) => (
                    <li key={r.status} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                      <span>{String(r.status).replace(/_/g, " ")}</span>
                      <span className="mono">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          {/* Evaluation history */}
          <Panel title="Evaluation history" defaultOpen={false}>
            {(data?.simulation_runs ?? []).length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No positioning evaluation has been saved yet. Run one in the Simulation module.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-xs py-2 pr-3 font-normal">Scenario</th>
                      <th className="label-xs py-2 pr-3 font-normal">Samples</th>
                      <th className="label-xs py-2 pr-3 font-normal">Noise σ</th>
                      <th className="label-xs py-2 pr-3 font-normal">Outage</th>
                      <th className="label-xs py-2 pr-3 font-normal">Drift</th>
                      <th className="label-xs py-2 pr-3 font-normal">Mean error (best method)</th>
                      <th className="label-xs py-2 font-normal">Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.simulation_runs ?? []).map((run) => {
                      const best = [...(run.methods ?? [])].sort((a, b) => (a.mean_error_m ?? 1e9) - (b.mean_error_m ?? 1e9))[0];
                      return (
                        <tr key={run.id} className="border-b border-border/60">
                          <td className="py-2.5 pr-3">{run.scenario_label}</td>
                          <td className="mono py-2.5 pr-3">{run.sample_count}</td>
                          <td className="mono py-2.5 pr-3">{run.noise_sigma_m} m</td>
                          <td className="mono py-2.5 pr-3">{Math.round((run.dropout_ratio ?? 0) * 100)}%</td>
                          <td className="mono py-2.5 pr-3">{run.drift_m_per_min} m/min</td>
                          <td className="mono py-2.5 pr-3">
                            {best ? `${best.label}: ${Math.round(best.mean_error_m)} m` : "—"}
                          </td>
                          <td className="mono py-2.5">{String(run.created_date ?? "").slice(0, 10)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Every figure here comes from recorded data. No forecast, prediction or model output is charted, because no
            trained model is connected to this app yet. Filters apply to the hazard charts; report and alert aggregations
            cover all districts.
          </p>
        </>
      )}
    </div>
  );
}