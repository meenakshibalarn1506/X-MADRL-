import { useState } from "react";
import { ArrowRight, RotateCcw, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FACTORS, DEFAULT_WEIGHTS, PRIORITY_PRESETS } from "@/lib/risk";
import { useLanguage } from "@/lib/i18n";

/**
 * "What would change this recommendation?" — changes the weights and re-runs the
 * same engine on the same data, then reports what actually changed.
 */
export default function WhatWouldChange({ journey, override, onRerun, onClear, busy }) {
  const { lang } = useLanguage();
  const [preset, setPreset] = useState(journey?.preferences?.priority ?? "balanced");
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS, ...(journey?.weights ?? {}) });

  const applyPreset = (key) => {
    setPreset(key);
    setWeights({ ...PRIORITY_PRESETS[key].weights });
  };

  const changed =
    override?.recommended_key && journey?.recommended_key && override.recommended_key !== journey.recommended_key;

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Change a priority and re-run the engine on the same hazard data. The result shows whether the recommendation
        actually changes, and by how much.
      </p>

      <div>
        <p className="label-xs">Priority preset</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(PRIORITY_PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              aria-pressed={preset === key}
              className={
                "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                (preset === key
                  ? "border-primary/60 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {lang === "ta" ? p.ta : p.en}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label-xs flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5" />
          Factor weights
        </p>
        <ul className="mt-2.5 space-y-3">
          {FACTORS.map((f) => (
            <li key={f.key}>
              <div className="flex items-center justify-between gap-3">
                <label className="text-[12px]" htmlFor={"w-" + f.key}>
                  {lang === "ta" ? f.ta : f.en}
                </label>
                <span className="mono text-[11.5px] text-muted-foreground">{weights[f.key].toFixed(2)}</span>
              </div>
              <input
                id={"w-" + f.key}
                type="range"
                min="0"
                max="2.5"
                step="0.05"
                value={weights[f.key]}
                onChange={(e) => {
                  setPreset("custom");
                  setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }));
                }}
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[hsl(var(--primary))]"
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onRerun(weights)} disabled={busy} className="gap-2">
          {busy ? "Recomputing" : "Re-run with these priorities"}
        </Button>
        {override && (
          <Button size="sm" variant="outline" onClick={onClear} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            Clear comparison
          </Button>
        )}
      </div>

      {override && !override.ok && (
        <p className="rounded-lg border border-risk-severe/40 bg-risk-severe/10 px-3 py-2 text-[12px] leading-relaxed text-risk-severe">
          With these weights no candidate route satisfies your constraints. The original recommendation still stands.
        </p>
      )}

      {override?.ok && journey?.ok && (
        <div className="rounded-xl border border-border bg-surface-2/50 p-4">
          <p className="label-xs">Result of the change</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="rounded-md border border-border px-2 py-1 font-mono">
              {journey.recommended_key}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 font-mono text-primary">
              {override.recommended_key}
            </span>
            {!changed && <span className="text-muted-foreground">— the recommendation does not change</span>}
          </div>

          {(() => {
            const before = journey.candidates.find((c) => c.key === journey.recommended_key);
            const after = override.candidates.find((c) => c.key === override.recommended_key);
            if (!before || !after) return null;
            const top = [...before.factors]
              .map((f) => ({
                key: f.key,
                delta: f.share - (after.factors.find((x) => x.key === f.key)?.share ?? 0),
              }))
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 2);
            return (
              <ul className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
                <li>
                  Distance {before.distance_km} km → {after.distance_km} km ({after.distance_km - before.distance_km >= 0 ? "+" : ""}
                  {Number((after.distance_km - before.distance_km).toFixed(1))} km)
                </li>
                <li>
                  Time {before.travel_time_min} min → {after.travel_time_min} min (
                  {after.travel_time_min - before.travel_time_min >= 0 ? "+" : ""}
                  {after.travel_time_min - before.travel_time_min} min)
                </li>
                <li>
                  Risk score {before.risk_score.toFixed(2)} → {after.risk_score.toFixed(2)}
                </li>
                {top.map((t) => (
                  <li key={t.key}>
                    {FACTORS.find((f) => f.key === t.key)?.[lang] ?? t.key} share moved by{" "}
                    {(Math.abs(t.delta) * 100).toFixed(1)} points
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}
    </div>
  );
}