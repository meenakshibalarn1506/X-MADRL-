import { Check, CircleSlash, FlaskConical, GitBranch, Info, Table2 } from "lucide-react";

const STAGES = [
  { key: "ingest", label: "Data ingestion", state: "not connected", detail: "Rainfall, river level, stagnation reports and road accessibility would be pulled from authorised feeds on a fixed refresh interval." },
  { key: "validate", label: "Validation", state: "design only", detail: "Range checks, duplicate suppression, timestamp sanity and source-confidence scoring. The rules are specified; no feed is attached to run them on." },
  { key: "features", label: "Feature construction", state: "design only", detail: "Time-series windows per node plus spatial aggregation across neighbouring road segments or grid cells, joined to terrain and historical inundation." },
  { key: "train", label: "Training", state: "not run", detail: "A spatio-temporal graph neural network would be trained on the constructed windows. No training run has been executed in this build." },
  { key: "evaluate", label: "Evaluation", state: "not run", detail: "Validation metrics, uncertainty and comparison against simple baselines would be produced here. Nothing is reported because nothing has been measured." },
  { key: "serve", label: "Serving predictions", state: "disabled", detail: "Live predictions stay switched off until a real model and pipeline are connected and evaluated." },
];

const FEATURES = [
  "Rainfall accumulation over rolling windows",
  "River and reservoir level readings",
  "Water stagnation reports with timestamps",
  "Road accessibility and closure status",
  "Historical inundation extents",
  "Terrain slope and elevation",
  "Official warnings in force",
];

const PROVENANCE = [
  { label: "Model version", value: "none — no model registered" },
  { label: "Training window", value: "not defined" },
  { label: "Feature snapshot", value: "not produced" },
  { label: "Prediction horizon", value: "not defined" },
  { label: "Validation metrics", value: "not measured" },
  { label: "Uncertainty estimate", value: "not available" },
  { label: "Compare with baselines", value: "not run" },
];

const STATE_CLASS = {
  "not connected": "border-border bg-surface-2 text-muted-foreground",
  "design only": "border-primary/40 bg-primary/10 text-primary",
  "not run": "border-risk-caution/40 bg-risk-caution/10 text-risk-caution",
  disabled: "border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated",
};

export default function PredictionPipeline() {
  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-[12px] leading-relaxed text-primary">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
        This section describes the intended pipeline and its provenance fields. No model is connected, so no prediction is
        displayed anywhere in this app — the map shows recorded observations, clearly labelled historical records and
        labelled synthetic scenarios only.
      </p>

      <div>
        <p className="label-xs flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          Pipeline stages
        </p>
        <ol className="mt-3 space-y-2.5">
          {STAGES.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-border bg-surface-1/60 px-3 py-2.5">
              <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-medium">
                <span className="mono text-muted-foreground">{i + 1}.</span>
                {s.label}
                <span className={"chip " + (STATE_CLASS[s.state] ?? STATE_CLASS["not run"])}>
                  {s.state === "not run" || s.state === "not connected" ? <CircleSlash className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  {s.state}
                </span>
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="label-xs">Graph and features the pipeline is designed for</p>
          <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <li>· Nodes: road segments or geographic cells.</li>
            <li>· Edges: road topology, plus distance between adjacent cells.</li>
            {FEATURES.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="label-xs flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            Provenance recorded for every prediction
          </p>
          <dl className="mt-2 space-y-1.5 text-[11.5px]">
            {PROVENANCE.map((p) => (
              <div key={p.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
                <dt className="text-muted-foreground">{p.label}</dt>
                <dd className="mono text-right">{p.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div>
        <p className="label-xs">Baseline comparison it will be judged against</p>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <li>· Persistence — today's condition carried forward.</li>
          <li>· Seasonal climatology — the historical rate for this period.</li>
          <li>· A simple logistic regression on the same features.</li>
        </ul>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          A model is only reported as useful once it beats these baselines on held-out data with a stated uncertainty and
          a recorded provenance trail. Until then this module stays descriptive, not predictive.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        The positioning evaluation above is a separate, implemented harness: it runs real algorithms on a labelled
        synthetic trace and reports real metrics. It is not a forecast and it is not a trained model.
      </p>
    </div>
  );
}