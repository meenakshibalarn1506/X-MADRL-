import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, RefreshCw, Info, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import StatCard from "@/components/cc/StatCard";
import SourceTable from "@/components/sources/SourceTable";
import { listDataSources, getSystemStatus } from "@/lib/server-fns";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/sources")({
  head: () => ({
    meta: [
      { title: "Data Sources and Freshness — X-MADRL" },
      { name: "description", content: "Registry of data sources, access method, refresh interval, last success and reliability." },
    ],
  }),
  component: SourcesPage,
});

const CONNECTOR_PLAN = [
  {
    group: "Authorised map and routing services",
    items: [
      { name: "Google Maps JavaScript API", state: "not configured", detail: "Requires a browser key restricted by website and API." },
      { name: "Google Traffic layer", state: "not configured", detail: "Switches on with the same key; traffic is then distinguishable from hazard data." },
      { name: "Google Routes API", state: "not configured", detail: "Server-side key, never sent to the browser. Adds traffic-aware ETA and alternatives." },
    ],
  },
  {
    group: "Official warnings",
    items: [
      { name: "Regional meteorological centre warnings", state: "permission required", detail: "No authorised feed is connected; no official alert is claimed anywhere in the app." },
      { name: "State disaster management bulletins", state: "permission required", detail: "Evacuation orders would be sourced here and marked as official." },
      { name: "District administration notices", state: "permission required", detail: "Per-district feeds would attach to the district selector." },
    ],
  },
  {
    group: "Road, water and infrastructure data",
    items: [
      { name: "Official road network geometries", state: "not connected", detail: "Routing currently uses the internal demonstration corridor graph." },
      { name: "Flood inundation and stagnation datasets", state: "not connected", detail: "Would allow hazard polygons instead of point radii." },
      { name: "Shelter and relief centre directory", state: "not connected", detail: "Would carry verified capacity and accessibility." },
    ],
  },
  {
    group: "Delivery channels",
    items: [
      { name: "SMS gateway", state: "not connected", detail: "No provider or credentials configured, so no SMS is sent." },
      { name: "Push notification service", state: "not connected", detail: "Browser notifications work only while the site is open and permission is granted." },
    ],
  },
];

function SourcesPage() {
  const { t } = useLanguage();
  const sourcesFn = useServerFn(listDataSources);
  const statusFn = useServerFn(getSystemStatus);

  const sources = useQuery({ queryKey: ["sources"], queryFn: () => sourcesFn({}) });
  const status = useQuery({ queryKey: ["system-status"], queryFn: () => statusFn({}) });

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("mod.sources.title")}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            What is genuinely connected, what is waiting on permission or a key, and how old each feed is.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            sources.refetch();
            status.refetch();
          }}
          disabled={sources.isFetching || status.isFetching}
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (sources.isFetching ? "animate-spin" : "")} />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sources registered"
          value={sources.data?.total ?? 0}
          tone="muted"
          hint={`${sources.data?.connected ?? 0} connected`}
        />
        <StatCard label="Road segments" value={status.data?.counts?.segments ?? 0} tone="primary" hint={`${status.data?.counts?.demonstration_segments ?? 0} demonstration`} />
        <StatCard label="Places indexed" value={status.data?.counts?.places ?? 0} tone="primary" />
        <StatCard label="Hazard records" value={status.data?.counts?.hazards ?? 0} tone="caution" />
      </div>

      <Panel title="Source registry" icon={Database} defaultOpen>
        {sources.isLoading ? (
          <p className="text-[12.5px] text-muted-foreground">Loading the registry…</p>
        ) : sources.isError ? (
          <p className="text-[12.5px] text-risk-severe">
            The registry could not be loaded: {String(sources.error?.message ?? "").slice(0, 140)}
          </p>
        ) : (
          <SourceTable sources={sources.data?.sources ?? []} google={sources.data?.google} />
        )}
      </Panel>

      <Panel title="Planned connectors and their exact state" icon={Layers} defaultOpen>
        <div className="grid gap-4 lg:grid-cols-2">
          {CONNECTOR_PLAN.map((group) => (
            <div key={group.group}>
              <p className="label-xs">{group.group}</p>
              <ul className="mt-2 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.name} className="rounded-lg border border-border bg-surface-1/60 px-3 py-2.5">
                    <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-medium">
                      {item.name}
                      <span
                        className={
                          "chip " +
                          (item.state === "not configured"
                            ? "border-risk-caution/40 bg-risk-caution/10 text-risk-caution"
                            : item.state === "permission required"
                              ? "border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated"
                              : "border-border bg-surface-2 text-muted-foreground")
                        }
                      >
                        {item.state}
                      </span>
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Credentials for these connectors live in server-side secrets and are never shipped to the browser. A browser key
          must be restricted by website and API before it is added. No restricted service is scraped and no endpoint is
          invented.
        </p>
      </Panel>
    </div>
  );
}