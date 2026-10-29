import { Database, Radio, TriangleAlert, FlaskConical } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const ROWS = [
  {
    icon: Database,
    label: "Basemap",
    value: "OpenStreetMap tiles (live)",
    state: "ok",
    note: "Google Maps Platform switch: not configured — add a key to enable the Google basemap, traffic layer and Routes API.",
  },
  {
    icon: Radio,
    label: "Official warning feeds",
    value: "0 connected",
    state: "warn",
    note: "No authorised meteorological or disaster-management feed is connected, so no official alert is claimed anywhere in the app.",
  },
  {
    icon: FlaskConical,
    label: "Demonstration data",
    value: "Labelled",
    state: "info",
    note: "The corridor network, hazards and shelters shipped with this build are demonstration records, stamped as demonstration or simulated. Nothing here is a live emergency.",
  },
  {
    icon: TriangleAlert,
    label: "Routing engine",
    value: "Internal risk-aware graph",
    state: "ok",
    note: "Routing runs on the internal corridor graph until the Google Routes API is configured, and the interface always states which source produced a route.",
  },
];

const STATE_CLASS = {
  ok: "text-risk-low border-risk-low/40 bg-risk-low/10",
  warn: "text-risk-elevated border-risk-elevated/40 bg-risk-elevated/10",
  info: "text-primary border-primary/40 bg-primary/10",
};

const STATE_LABEL = { ok: "Available", warn: "Not configured", info: "Labelled" };

export default function SystemStatus() {
  const { t } = useLanguage();
  return (
    <section id="status" className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">System status and data honesty</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            What is genuinely connected, what is demonstration data, and what stays switched off until
            you configure it.
          </p>
        </div>
        <span className="chip">no invented incidents</span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {ROWS.map((r) => (
          <div key={r.label} className="rounded-xl border border-border bg-surface-1/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <r.icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
                <div>
                  <p className="label-xs">{r.label}</p>
                  <p className="mt-1 text-sm font-semibold">{r.value}</p>
                </div>
              </div>
              <span className={"chip shrink-0 " + STATE_CLASS[r.state]}>{STATE_LABEL[r.state]}</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{r.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface-1/60 p-5">
        <p className="label-xs">{t("legend.title")} · data classes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip text-risk-low border-risk-low/40 bg-risk-low/10">{t("common.observed")}</span>
          <span className="chip text-primary border-primary/40 bg-primary/10">{t("common.official")}</span>
          <span className="chip text-risk-caution border-risk-caution/40 bg-risk-caution/10">{t("common.forecast")}</span>
          <span className="chip text-muted-foreground">{t("common.simulated")}</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Every hazard, alert and layer in the app carries one of these four stamps, plus its source
          and last-update time. Observed incidents, official warnings, model forecasts and
          demonstration scenarios are never blended into one undifferentiated view.
        </p>
      </div>
    </section>
  );
}