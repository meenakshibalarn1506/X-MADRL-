import { CircleCheck, CircleSlash, Clock, Database, Lock, Wrench } from "lucide-react";
import { FRESHNESS } from "@/lib/risk";

const STATUS = {
  connected: { label: "Connected", className: "border-risk-low/40 bg-risk-low/10 text-risk-low", Icon: CircleCheck },
  configured_not_tested: {
    label: "Configured, not tested",
    className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution",
    Icon: Wrench,
  },
  permission_required: {
    label: "Permission required",
    className: "border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated",
    Icon: Lock,
  },
  not_connected: { label: "Not connected", className: "border-border bg-surface-2 text-muted-foreground", Icon: CircleSlash },
};

const RELIABILITY = { high: "high", medium: "medium", low: "low", unknown: "not assessed" };

function staleness(hours) {
  if (hours == null) return { label: "never updated", className: "text-risk-unknown" };
  if (hours <= FRESHNESS.freshHours) return { label: `${hours} h ago · fresh`, className: "text-risk-low" };
  if (hours <= FRESHNESS.ageingHours) return { label: `${hours} h ago · ageing`, className: "text-risk-caution" };
  return { label: `${hours} h ago · stale`, className: "text-risk-severe" };
}

function fmt(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 16).replace("T", " ");
}

/**
 * Source registry: what is connected, how it is accessed, when it last updated
 * and how reliable it is. A stale source is labelled stale rather than being
 * quietly presented as live.
 */
export default function SourceTable({ sources = [], google }) {
  return (
    <div className="space-y-4">
      {google && !google.configured && (
        <p className="flex items-start gap-2 rounded-lg border border-risk-caution/40 bg-risk-caution/10 px-3 py-2.5 text-[12px] leading-relaxed text-risk-caution">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          {google.notice}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-xs py-2 pr-3 font-normal">Source</th>
              <th className="label-xs py-2 pr-3 font-normal">Category</th>
              <th className="label-xs py-2 pr-3 font-normal">Access</th>
              <th className="label-xs py-2 pr-3 font-normal">Status</th>
              <th className="label-xs py-2 pr-3 font-normal">Refresh</th>
              <th className="label-xs py-2 pr-3 font-normal">Last success</th>
              <th className="label-xs py-2 pr-3 font-normal">Reliability</th>
              <th className="label-xs py-2 font-normal">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const st = STATUS[s.access_status] ?? STATUS.not_connected;
              const age = staleness(s.staleness_hours);
              return (
                <tr key={s.id} className="border-b border-border/60 align-top">
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{s.name}</span>
                    {s.is_official && <span className="ml-2 chip border-primary/40 bg-primary/10 text-primary">official</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{String(s.category ?? "").replace(/_/g, " ")}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{s.access_method ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <span className={"chip " + st.className}>
                      <st.Icon className="h-3 w-3" />
                      {st.label}
                    </span>
                  </td>
                  <td className="mono py-2.5 pr-3 text-muted-foreground">
                    {s.refresh_interval_minutes ? `${s.refresh_interval_minutes} min` : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="mono block text-muted-foreground">{fmt(s.last_success_at)}</span>
                    <span className={"mono flex items-center gap-1 text-[10.5px] " + age.className}>
                      <Clock className="h-3 w-3" />
                      {age.label}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{RELIABILITY[s.reliability] ?? s.reliability ?? "—"}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {s.notes}
                    {s.requires_secret ? (
                      <span className="mono mt-1 block text-[10.5px] text-risk-caution">
                        requires secret: {s.requires_secret}
                      </span>
                    ) : null}
                    {s.setup_hint ? <span className="mt-1 block text-[10.5px]">{s.setup_hint}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}