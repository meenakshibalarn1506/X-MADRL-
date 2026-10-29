import { Check, X } from "lucide-react";
import { SeverityBadge } from "@/components/cc/Badges";
import { bandFor } from "@/lib/risk";
import { fmtKm, fmtMinutes } from "@/lib/geo";

export default function ComparisonTable({ journey }) {
  if (!journey) return null;
  const candidates = journey.candidates ?? [];
  const shortest = journey.baselines?.shortest;
  const fastest = journey.baselines?.fastest;

  const rows = [
    ...candidates,
    ...(shortest && !candidates.some((c) => c.key === "baseline-shortest")
      ? [{ ...shortest, label: "Shortest distance (baseline)" }]
      : []),
    ...(fastest && fastest.key !== shortest?.key && !candidates.some((c) => c.key === "baseline-fastest")
      ? [{ ...fastest, label: "Fastest (baseline)" }]
      : []),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="label-xs py-2 pr-3 font-normal">Route</th>
            <th className="label-xs py-2 pr-3 font-normal">Distance</th>
            <th className="label-xs py-2 pr-3 font-normal">Time</th>
            <th className="label-xs py-2 pr-3 font-normal">Risk score</th>
            <th className="label-xs py-2 pr-3 font-normal">Hazards</th>
            <th className="label-xs py-2 pr-3 font-normal">Closures</th>
            <th className="label-xs py-2 pr-3 font-normal">Confidence</th>
            <th className="label-xs py-2 font-normal">Feasible</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={
                "border-b border-border/60 " + (r.key === journey.recommended_key ? "bg-primary/[0.06]" : "")
              }
            >
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2">
                  {r.key === journey.recommended_key && <Check className="h-3.5 w-3.5 text-primary" />}
                  {r.key === journey.recommended_key ? "Recommended" : r.label}
                </span>
              </td>
              <td className="mono py-2.5 pr-3">{fmtKm(r.distance_km)}</td>
              <td className="mono py-2.5 pr-3">{fmtMinutes(r.travel_time_min)}</td>
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2">
                  <span className="mono">{r.risk_score?.toFixed(2)}</span>
                  <SeverityBadge level={bandFor(r.risk_score)} />
                </span>
              </td>
              <td className="mono py-2.5 pr-3">{r.hazards?.length ?? 0}</td>
              <td className="mono py-2.5 pr-3">{r.closures?.length ?? 0}</td>
              <td className="mono py-2.5 pr-3">
                {r.uncertainty?.min_confidence == null ? "—" : `${Math.round(r.uncertainty.min_confidence * 100)}%`}
              </td>
              <td className="py-2.5">
                {r.suitable === false ? (
                  <span className="flex items-center gap-1.5 text-risk-severe">
                    <X className="h-3.5 w-3.5" />
                    excluded
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-risk-low">
                    <Check className="h-3.5 w-3.5" />
                    yes
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}