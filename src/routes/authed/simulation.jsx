import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Compass, BrainCircuit, Save } from "lucide-react";
import Panel from "@/components/cc/Panel";
import PositionSimulator from "@/components/gps/PositionSimulator";
import PredictionPipeline from "@/components/simulation/PredictionPipeline";
import { getSimulationNetwork, listSimulationRuns, saveSimulationRun } from "@/lib/server-fns";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation and Evaluation — X-MADRL" },
      { name: "description", content: "Labelled synthetic scenarios, map-matching evaluation metrics and the prediction pipeline's provenance." },
    ],
  }),
  component: SimulationPage,
});

function SimulationPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const networkFn = useServerFn(getSimulationNetwork);
  const runsFn = useServerFn(listSimulationRuns);
  const saveFn = useServerFn(saveSimulationRun);

  const network = useQuery({ queryKey: ["sim-network"], queryFn: () => networkFn({}) });
  const runs = useQuery({ queryKey: ["sim-runs"], queryFn: () => runsFn({}) });

  const save = useMutation({
    mutationFn: (payload) => saveFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sim-runs"] }),
  });

  return (
    <div className="space-y-3 p-3">
      <div>
        <h1 className="text-xl font-semibold">{t("mod.simulation.title")}</h1>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
          Two things live here: an evaluation harness that tests the positioning and map-matching behaviour on a labelled
          synthetic trace, and the design of the prediction pipeline. There are no live predictions in this build.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Positioning evaluation" subtitle="Real algorithms, synthetic ground truth" icon={Compass} defaultOpen>
          {network.isLoading ? (
            <p className="text-[12.5px] text-muted-foreground">Loading the road graph…</p>
          ) : network.isError ? (
            <p className="text-[12.5px] text-risk-severe">
              The road graph could not be loaded: {String(network.error?.message ?? "").slice(0, 140)}
            </p>
          ) : (
            <PositionSimulator
              segments={network.data?.segments ?? []}
              onSaveRun={(payload) => save.mutate(payload)}
              busy={save.isPending}
            />
          )}
        </Panel>

        <Panel title="Prediction pipeline (ST-GNN)" subtitle="Design and provenance" icon={BrainCircuit} defaultOpen>
          <PredictionPipeline />
        </Panel>
      </div>

      <Panel title="Saved evaluation runs" icon={FlaskConical} defaultOpen>
        {runs.isLoading ? (
          <p className="text-[12.5px] text-muted-foreground">Loading runs…</p>
        ) : (runs.data?.runs ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            No evaluation has been saved yet. Run the harness above and save it to keep the metrics alongside the
            parameters that produced them.
          </p>
        ) : (
          <div className="space-y-4">
            {(runs.data.runs ?? []).map((run) => (
              <div key={run.id} className="rounded-lg border border-border bg-surface-1/60 p-3.5">
                <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-medium">
                  {run.scenario_label}
                  <span className="chip">seed-driven synthetic trace</span>
                  <span className="mono text-[10.5px] text-muted-foreground">
                    {String(run.created_date ?? "").slice(0, 16).replace("T", " ")}
                  </span>
                </p>
                <p className="mono mt-1.5 text-[11px] text-muted-foreground">
                  samples {run.sample_count} · σ {run.noise_sigma_m} m · outage {Math.round((run.dropout_ratio ?? 0) * 100)}% ·
                  drift {run.drift_m_per_min} m/min · engine {run.engine_version}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-[11.5px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="label-xs py-1.5 pr-3 font-normal">Method</th>
                        <th className="label-xs py-1.5 pr-3 font-normal">Mean error</th>
                        <th className="label-xs py-1.5 pr-3 font-normal">p95</th>
                        <th className="label-xs py-1.5 pr-3 font-normal">Road accuracy</th>
                        <th className="label-xs py-1.5 pr-3 font-normal">Recovery</th>
                        <th className="label-xs py-1.5 font-normal">Calibration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(run.methods ?? []).map((m) => (
                        <tr key={m.key} className="border-b border-border/60">
                          <td className="py-1.5 pr-3">{m.label}</td>
                          <td className="mono py-1.5 pr-3">{Math.round(m.mean_error_m)} m</td>
                          <td className="mono py-1.5 pr-3">{Math.round(m.p95_error_m)} m</td>
                          <td className="mono py-1.5 pr-3">{Math.round((m.road_accuracy ?? 0) * 100)}%</td>
                          <td className="mono py-1.5 pr-3">{m.recovery_time_s == null ? "—" : `${Math.round(m.recovery_time_s)} s`}</td>
                          <td className="mono py-1.5">
                            {m.uncertainty_coverage == null ? "not reported" : `${Math.round(m.uncertainty_coverage * 100)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {run.notes && <p className="mt-2 text-[11px] text-muted-foreground">{run.notes}</p>}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Save className="h-3.5 w-3.5" />
          Metrics are stored with the parameters that produced them, so a result can always be reproduced from its seed.
        </p>
      </Panel>
    </div>
  );
}