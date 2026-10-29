import { Check, Info, TriangleAlert, CircleHelp, Clock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { freshnessOf, FRESHNESS_LABEL } from "@/lib/risk";

// Risk is never encoded by colour alone: every badge carries an icon and a word.

const DATA_CLASS = {
  observed: { key: "common.observed", className: "border-risk-low/40 bg-risk-low/10 text-risk-low", Icon: Check },
  official: { key: "common.official", className: "border-primary/40 bg-primary/10 text-primary", Icon: Check },
  forecast: { key: "common.forecast", className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution", Icon: Info },
  historical: { key: "common.observed", className: "border-risk-low/40 bg-risk-low/10 text-risk-low", Icon: Clock },
  simulated: { key: "common.simulated", className: "border-border bg-surface-2 text-muted-foreground", Icon: Info },
};

export function DataClassBadge({ value = "simulated" }) {
  const { t } = useLanguage();
  const cfg = DATA_CLASS[value] ?? DATA_CLASS.simulated;
  return (
    <span className={"chip " + cfg.className}>
      <cfg.Icon className="h-3 w-3" />
      {t(cfg.key)}
    </span>
  );
}

const SEVERITY = {
  low: { className: "border-risk-low/40 bg-risk-low/10 text-risk-low", label: "Low", Icon: Check },
  caution: { className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution", label: "Caution", Icon: Info },
  elevated: { className: "border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated", label: "Elevated", Icon: TriangleAlert },
  severe: { className: "border-risk-severe/40 bg-risk-severe/10 text-risk-severe", label: "Severe", Icon: TriangleAlert },
  unknown: { className: "border-border bg-surface-2 text-muted-foreground", label: "Not assessed", Icon: CircleHelp },
};

export function SeverityBadge({ level = "unknown" }) {
  const cfg = SEVERITY[level] ?? SEVERITY.unknown;
  return (
    <span className={"chip " + cfg.className}>
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const FRESH_CLASS = {
  fresh: "border-risk-low/40 bg-risk-low/10 text-risk-low",
  ageing: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution",
  stale: "border-risk-severe/40 bg-risk-severe/10 text-risk-severe",
  unknown: "border-border bg-surface-2 text-muted-foreground",
};

export function FreshnessBadge({ updatedAt, now, withAge = false }) {
  const { lang } = useLanguage();
  const f = freshnessOf(updatedAt, now);
  const entry = FRESHNESS_LABEL[f.state] ?? FRESHNESS_LABEL.unknown;
  const stateText = entry[lang] ?? entry.en;
  const age = f.hours == null ? "" : f.hours < 1 ? " · <1 h" : ` · ${Math.round(f.hours)} h`;
  return (
    <span className={"chip " + FRESH_CLASS[f.state]} title={stateText + age}>
      <Clock className="h-3 w-3" />
      {stateText}
      {withAge ? age : ""}
    </span>
  );
}

export function VerdictBadge({ ok, okText, badText }) {
  return (
    <span
      className={
        "chip " +
        (ok ? "border-risk-low/40 bg-risk-low/10 text-risk-low" : "border-risk-severe/40 bg-risk-severe/10 text-risk-severe")
      }
    >
      {ok ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
      {ok ? okText : badText}
    </span>
  );
}

export function SourceLine({ source, updatedAt, extra }) {
  const { t } = useLanguage();
  return (
    <p className="font-mono text-[10.5px] leading-relaxed text-muted-foreground">
      {t("common.source")}: {source || t("common.unknown")}
      {updatedAt ? ` · ${t("common.lastUpdated")}: ${String(updatedAt).slice(0, 16).replace("T", " ")}` : ""}
      {extra ? ` · ${extra}` : ""}
    </p>
  );
}