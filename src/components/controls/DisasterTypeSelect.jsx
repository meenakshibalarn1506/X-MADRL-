import { HAZARD_TYPES } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

const TONE_RING = {
  low: "border-risk-low/50",
  caution: "border-risk-caution/50",
  elevated: "border-risk-elevated/50",
  severe: "border-risk-severe/50",
};

const TONE_ON = {
  low: "bg-risk-low/15 text-risk-low",
  caution: "bg-risk-caution/15 text-risk-caution",
  elevated: "bg-risk-elevated/15 text-risk-elevated",
  severe: "bg-risk-severe/15 text-risk-severe",
};

/** Multi-select hazard class picker. Each chip carries its label, so colour is never the only cue. */
export default function DisasterTypeSelect({ selected = [], onToggle, className = "" }) {
  const { lang } = useLanguage();
  return (
    <div className={"flex flex-wrap gap-1.5 " + className}>
      <button
        type="button"
        onClick={() => onToggle("__all__")}
        aria-pressed={selected.length === 0}
        className={
          "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
          (selected.length === 0
            ? "border-primary/60 bg-primary/12 text-primary"
            : "border-border text-muted-foreground hover:text-foreground")
        }
      >
        All hazards
      </button>
      {HAZARD_TYPES.map((h) => {
        const on = selected.includes(h.key);
        return (
          <button
            key={h.key}
            type="button"
            onClick={() => onToggle(h.key)}
            aria-pressed={on}
            className={
              "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
              (on ? TONE_ON[h.tone] + " " + TONE_RING[h.tone] : "border-border text-muted-foreground hover:text-foreground")
            }
          >
            {lang === "ta" ? h.ta : h.en}
          </button>
        );
      })}
    </div>
  );
}