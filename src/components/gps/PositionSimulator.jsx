import { useState } from "react";
import { FlaskConical, Play, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildScenario, runMatchingEvaluation } from "@/lib/mapmatching";

const SCENARIOS = [
  { key: "clean", label: "Ordinary urban noise", sigma: 35, dropout: 0, drift: 0 },
  { key: "dropout", label: "Tunnel / outage with drift", sigma: 60, dropout: 0.14, drift: 150 },
  { key: "severe", label: "Severe multipath and long outage", sigma: 140, dropout: 0.22, drift: 260 },
];

const METRIC = [
  { key: "mean_error_m", label: "Mean error", unit: "m", better: "low" },
  { key: "p95_error_m", label: "95th percentile error", unit: "m", better: "low" },
  { key: "road_accuracy", label: "Road-assignment accuracy", unit: "%", better: "high" },
  { key: "recovery_time_s", label: "Recovery time after outage", unit: "s", better: "low" },
  { key: "uncertainty_coverage", label: "Uncertainty calibration", unit: "%", better: "high" },
];

function formatMetric(key, value) {
  if (value == null) return "not reported";
  if (key === "road_accuracy" || key === "uncertainty_coverage") return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}`;
}

/**
 * Labelled simulation mode. Ground truth is generated synthetically, every run
 * says so on screen, and nothing here is presented as a measurement of real
 * navigation performance.
 */
export default function PositionSimulator({ segments, onSaveRun, busy }) {
  const [scenarioKey, setScenarioKey] = useState("dropout");
  const [seed, setSeed] = useState(7);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[1];

  const run = () => {
    setRunning(true);
    const built = buildScenario({
      segments,
      seed,
      sigmaM: scenario.sigma,
      dropoutLenFrac: scenario.dropout,
      driftMperMin: scenario.drift,
      sampleCount: 140,
    });
    if (!built) {
      setResult({ error: "The road graph does not contain a usable corridor for the simulation." });
      setRunning(false);
      return;
    }
    const evaluation = runMatchingEvaluation({ segments, scenario: built });
    setResult({ scenario: built, evaluation });
    setRunning(false);
  };

  const save = () => {
    if (!result?.evaluation) return;
    onSaveRun({
      scenario_key: scenario.key,
      scenario_label: scenario.label,
      mode: "synthetic_trace",
      sample_count: result.scenario.params.sampleCount,
      noise_sigma_m: result.scenario.params.sigmaM,
      dropout_ratio: scenario.dropout,
      drift_m_per_min: result.scenario.params.driftMperMin,
      methods: result.evaluation.methods.map((m) => ({
        key: m.key,
        label: m.label,
        mean_error_m: m.metrics.mean_error_m ?? 0,
        p95_error_m: m.metrics.p95_error_m ?? 0,
        road_accuracy: m.metrics.road_accuracy ?? 0,
        recovery_time_s: m.metrics.recovery_time_s ?? 0,
        uncertainty_coverage: m.metrics.uncertainty_coverage ?? 0,
      })),
      notes: `Deterministic seed ${seed}. Synthetic ground truth, ${result.scenario.corridor.length} corridor segments.`,
    });
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-[12px] leading-relaxed text-primary">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
        Simulation mode. A synthetic trace is generated along a corridor of the road graph, then the same trace is
        matched by three different methods. The ground truth is synthetic and labelled as such.
      </p>

      <div>
        <p className="label-xs">Test scenario</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScenarioKey(s.key)}
              aria-pressed={scenarioKey === s.key}
              className={
                "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                (scenarioKey === s.key
                  ? "border-primary/60 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label-xs" htmlFor="sim-seed">
            Deterministic seed
          </label>
          <input
            id="sim-seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 1)}
            className="mono mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          />
        </div>
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <p className="label-xs">Injected noise</p>
          <p className="mono mt-1 text-[13px]">σ = {scenario.sigma} m</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <p className="label-xs">Outage and drift</p>
          <p className="mono mt-1 text-[13px]">
            {Math.round(scenario.dropout * 100)}% · {scenario.drift} m/min
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={run} disabled={running} className="gap-2">
          <Play className="h-3.5 w-3.5" />
          {running ? "Running" : "Run evaluation"}
        </Button>
        {result?.evaluation && (
          <Button size="sm" variant="outline" onClick={save} disabled={busy} className="gap-2">
            <Save className="h-3.5 w-3.5" />
            Save this run
          </Button>
        )}
      </div>

      {result?.error && (
        <p className="rounded-lg border border-risk-caution/40 bg-risk-caution/10 px-3 py-2 text-[12px] text-risk-caution">
          {result.error}
        </p>
      )}

      {result?.evaluation && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-xs py-2 pr-3 font-normal">Method</th>
                  {METRIC.map((m) => (
                    <th key={m.key} className="label-xs py-2 pr-3 font-normal">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.evaluation.methods.map((m) => (
                  <tr key={m.key} className="border-b border-border/60">
                    <td className="py-2.5 pr-3">{m.label}</td>
                    {METRIC.map((metric) => (
                      <td key={metric.key} className="mono py-2.5 pr-3">
                        {formatMetric(metric.key, m.metrics[metric.key])}
                        {m.metrics[metric.key] != null && metric.unit !== "%" ? ` ${metric.unit}` : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="label-xs">Trace summary</p>
            <ul className="mono mt-2 space-y-1 text-[11.5px] text-muted-foreground">
              <li>corridor segments: {result.scenario.corridor.length}</li>
              <li>sampled fixes: {result.scenario.params.sampleCount} (one per {result.scenario.params.dtSeconds} s)</li>
              <li>
                outage window: fixes {result.scenario.params.dropoutStart}–{result.scenario.params.dropoutEnd} (
                {result.scenario.params.dropoutSeconds} s of dead reckoning)
              </li>
              <li>ground truth: synthetic</li>
            </ul>
          </div>

          <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {result.evaluation.note}
          </p>
        </div>
      )}
    </div>
  );
}