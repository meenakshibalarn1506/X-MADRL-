import { Info } from "lucide-react";
import { FACTOR_BY_KEY } from "@/lib/risk";
import { useLanguage } from "@/lib/i18n";

const EXPLAIN = {
  hazard: "Severity and confidence of hazards whose evidence names these road segments.",
  closure: "Confirmed closures and access restrictions. A trustworthy confirmed closure removes the segment from the graph entirely.",
  flood: "How much of the segment is exposed to flood or inundation in the hazard layer.",
  damage: "Reported surface damage, and for walking whether a footpath exists.",
  traffic: "Congestion where traffic information exists. Ordinary congestion and disaster-related road danger are reported separately.",
  uncertainty: "How old the evidence is and how confident the source was. Older, vaguer evidence raises this term.",
  time: "Travel time at the speed assumed for the chosen mode.",
  distance: "Total distance along the route.",
};

const BAR = {
  hazard: "bg-risk-severe",
  closure: "bg-risk-severe",
  flood: "bg-risk-elevated",
  damage: "bg-risk-caution",
  traffic: "bg-risk-caution",
  uncertainty: "bg-primary",
  time: "bg-accent",
  distance: "bg-muted-foreground",
};

export default function FactorBreakdown({ factors = [], title = "Factor breakdown" }) {
  const { lang } = useLanguage();
  const max = factors.reduce((m, f) => Math.max(m, f.share), 0) || 1;

  return (
    <div>
      <p className="label-xs">{title}</p>
      <ul className="mt-3 space-y-3">
        {factors.map((f) => {
          const label = FACTOR_BY_KEY[f.key]?.[lang] ?? FACTOR_BY_KEY[f.key]?.en ?? f.key;
          return (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium">{label}</span>
                <span className="mono text-[11.5px] text-muted-foreground">
                  {(f.share * 100).toFixed(1)}% · weight {f.weight.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={"h-full rounded-full " + (BAR[f.key] ?? "bg-primary")}
                  style={{ width: `${Math.max(2, (f.share / max) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{EXPLAIN[f.key]}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        These percentages are an exact decomposition of the cost function that ranked the route: every factor's
        contribution is summed from the segments actually used, and they add up to 100%. They are not model
        attributions, and no SHAP values, probabilities or learned feature importances are shown anywhere in this app.
      </p>
    </div>
  );
}