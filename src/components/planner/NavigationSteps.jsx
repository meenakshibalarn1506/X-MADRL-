import {
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  CornerUpRight,
  CornerUpLeft,
  RotateCcw,
  Navigation,
  MapPin,
  Circle,
  Play,
  ChevronRight,
  ChevronLeft,
  Square,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function stepIcon(type, modifier) {
  if (type === "arrive") return MapPin;
  if (type === "depart") return Navigation;
  if (modifier === "right" || modifier === "sharp right") return ArrowRight;
  if (modifier === "left" || modifier === "sharp left") return ArrowLeft;
  if (modifier === "slight right") return CornerUpRight;
  if (modifier === "slight left") return CornerUpLeft;
  if (modifier === "uturn") return RotateCcw;
  if (type === "roundabout" || type === "rotary") return Circle;
  return ArrowUp;
}

function fmtDist(m) {
  if (!m || m <= 0) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Step-by-step navigation directions for the selected route.
 * Supports step selection (highlights the segment on the map) and a
 * route-preview mode that walks through steps one at a time.
 *
 * This is a route preview — not live GPS tracking or voice-guided
 * turn-by-turn navigation. Those capabilities are not implemented.
 */
export default function NavigationSteps({
  steps,
  selectedStep,
  onSelectStep,
  isNavigating,
  onStartNav,
  onNextStep,
  onPrevStep,
  onEndNav,
}) {
  if (!steps || steps.length === 0) return null;

  const currentIdx = selectedStep ?? 0;

  return (
    <div className="rounded-xl border border-border bg-surface-1/60">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <p className="text-[13px] font-semibold">Navigation steps</p>
          <p className="text-[11px] text-muted-foreground">
            {steps.length} steps · route preview, not live GPS
          </p>
        </div>
        {isNavigating ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={onPrevStep} disabled={currentIdx === 0} className="h-8 w-8 p-0">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="mono text-[11px] text-muted-foreground">
              {currentIdx + 1}/{steps.length}
            </span>
            <Button size="sm" variant="outline" onClick={onNextStep} disabled={currentIdx >= steps.length - 1} className="h-8 w-8 p-0">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={onEndNav} className="gap-1.5">
              <Square className="h-3 w-3" />
              End
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={onStartNav} className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            Start Navigation
          </Button>
        )}
      </div>

      <ol className="max-h-72 overflow-y-auto">
        {steps.map((step, i) => {
          const Icon = stepIcon(step.maneuver_type, step.maneuver_modifier);
          const isSelected = selectedStep === i;
          const isPast = isNavigating && selectedStep != null && i < selectedStep;
          return (
            <li key={i} className="border-b border-border/50 last:border-0">
              <button
                type="button"
                onClick={() => onSelectStep(isSelected ? null : i)}
                className={
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors " +
                  (isSelected ? "bg-primary/10" : "hover:bg-surface-2/50")
                }
              >
                <span
                  className={
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border " +
                    (isSelected ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground")
                  }
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={"block text-[12.5px] " + (isPast ? "text-muted-foreground line-through" : "")}>
                    {step.instruction}
                  </span>
                  <span className="mono mt-0.5 block text-[10.5px] text-muted-foreground">
                    {step.road ? `${step.road} · ` : ""}
                    {fmtDist(step.distance_m)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border px-3 py-2">
        <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          Route preview with step-by-step directions. Live GPS tracking, voice-guided
          turn-by-turn navigation, and real-time rerouting are not available in this build.
        </p>
      </div>
    </div>
  );
}