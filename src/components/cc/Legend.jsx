import { useLanguage } from "@/lib/i18n";

const TONE = {
  low: "bg-risk-low",
  caution: "bg-risk-caution",
  elevated: "bg-risk-elevated",
  severe: "bg-risk-severe",
  unknown: "bg-risk-unknown",
  primary: "bg-primary",
};

const RING = {
  low: "border-risk-low",
  caution: "border-risk-caution",
  elevated: "border-risk-elevated",
  severe: "border-risk-severe",
  unknown: "border-risk-unknown",
  primary: "border-primary",
};

const TEXT = {
  low: "text-risk-low",
  caution: "text-risk-caution",
  elevated: "text-risk-elevated",
  severe: "text-risk-severe",
  unknown: "text-risk-unknown",
  primary: "text-primary",
};

const SHAPE = {
  circle: "rounded-full",
  square: "rounded-[2px]",
  diamond: "rotate-45 rounded-[2px]",
  line: "h-[3px] w-5 rounded-full bg-current",
};

/**
 * Layer legend with toggles. Each entry shows a shape + colour + label + source
 * note, so a layer is never identified by colour alone.
 */
export default function Legend({ items = [], onToggle, className = "" }) {
  const { t } = useLanguage();
  return (
    <div className={"space-y-2 " + className}>
      <p className="label-xs">{t("legend.title")}</p>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const on = item.active !== false;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onToggle?.(item.key, !on)}
                disabled={item.available === false}
                aria-pressed={on}
                className={
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors " +
                  (item.available === false
                    ? "cursor-not-allowed opacity-45"
                    : "hover:bg-surface-2 " + (on ? "" : "opacity-55"))
                }
              >
                <span
                  className={
                    "shrink-0 border " +
                    (RING[item.tone] ?? RING.primary) +
                    " " +
                    (TEXT[item.tone] ?? TEXT.primary) +
                    " " +
                    (SHAPE[item.shape ?? "circle"] ?? SHAPE.circle) +
                    (item.shape === "line" ? "" : " h-3 w-3")
                  }
                >
                  {item.shape === "line" ? null : (
                    <span className={"block h-full w-full scale-[0.62] rounded-full " + (TONE[item.tone] ?? TONE.primary)} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{item.label}</span>
                  {item.note ? <span className="block truncate text-[10.5px] text-muted-foreground">{item.note}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {item.available === false ? t("common.notConnected") : on ? "on" : "off"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}