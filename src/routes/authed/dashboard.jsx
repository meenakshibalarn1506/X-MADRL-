import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Layers,
  Waves,
  Droplets,
  Construction,
  Ban,
  Wind,
  Activity,
  Mountain,
  Flame,
  Factory,
  Boxes,
  TriangleAlert,
  Home,
  Cross,
  Shield,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SmartMap from "@/components/map/SmartMap";
import Panel from "@/components/cc/Panel";
import Legend from "@/components/cc/Legend";
import StatCard from "@/components/cc/StatCard";
import HazardDetail from "@/components/map/HazardDetail";
import DistrictSelect from "@/components/controls/DistrictSelect";
import DisasterTypeSelect from "@/components/controls/DisasterTypeSelect";
import PlaceSearch from "@/components/controls/PlaceSearch";
import { getDashboardData } from "@/lib/server-fns";
import { HAZARD_TYPES, TN_CENTER, districtLabel, hazardLabel } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({
    meta: [
      { title: "Live Disaster Map — X-MADRL" },
      { name: "description", content: "Statewide multi-hazard map for Tamil Nadu with layer legend, source labels and data freshness." },
    ],
  }),
  component: DashboardMap,
});

const HAZARD_ICON = {
  flood: Waves,
  stagnation: Droplets,
  damaged_road: Construction,
  closure: Ban,
  cyclone: Wind,
  earthquake: Activity,
  landslide: Mountain,
  fire: Flame,
  industrial: Factory,
  debris: Boxes,
  other: TriangleAlert,
  tsunami: Waves,
};

const FACILITY_LAYERS = [
  { key: "shelter", labelKey: "legend.shelters", tone: "low", Icon: Home },
  { key: "hospital", labelKey: "legend.hospitals", tone: "primary", Icon: Cross },
  { key: "relief_centre", labelKey: "legend.relief", tone: "caution", Icon: Shield },
];

function toneForSeverity(severity) {
  if (severity === "severe") return "severe";
  if (severity === "elevated") return "elevated";
  if (severity === "caution") return "caution";
  return "low";
}

function DashboardMap() {
  const { t, lang } = useLanguage();
  const fn = useServerFn(getDashboardData);

  const [district, setDistrict] = useState("all");
  const [types, setTypes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [facilityTypes, setFacilityTypes] = useState(["shelter", "hospital", "relief_centre"]);
  const [showRoads, setShowRoads] = useState(true);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState({ lat: 13.0827, lng: 80.2707, zoom: 11 });
  const [panelsOpen, setPanelsOpen] = useState(true);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", district, [...types].sort().join(","), [...classes].sort().join(",")],
    queryFn: () => fn({ data: { district, hazard_types: types, data_classes: classes } }),
  });

  const hazards = data?.hazards ?? [];
  const facilities = data?.shelters ?? [];
  const segments = data?.segments ?? [];

  const toggleType = (key) => {
    if (key === "__all__") {
      setTypes([]);
      return;
    }
    setTypes((list) => (list.includes(key) ? list.filter((v) => v !== key) : [...list, key]));
  };

  const toggleClass = (key) => setClasses((list) => (list.includes(key) ? list.filter((v) => v !== key) : [...list, key]));
  const toggleFacility = (key) => setFacilityTypes((list) => (list.includes(key) ? list.filter((v) => v !== key) : [...list, key]));

  const hazardMarkers = useMemo(
    () =>
      hazards
        .filter((h) => h.lat != null)
        .map((h) => ({
          id: h.id,
          lat: h.lat,
          lng: h.lng,
          tone: toneForSeverity(h.severity),
          Icon: HAZARD_ICON[h.hazard_type] ?? TriangleAlert,
          label: `${hazardLabel(h.hazard_type, lang)}${h.is_demonstration ? " (demo)" : ""}`,
          selected: selected?.id === h.id,
          pulse: h.severity === "severe",
          onClick: () => setSelected(h),
        })),
    [hazards, selected, lang],
  );

  const facilityMarkers = useMemo(
    () =>
      facilities
        .filter((f) => f.lat != null && facilityTypes.includes(f.facility_type))
        .map((f) => {
          const layer = FACILITY_LAYERS.find((l) => l.key === f.facility_type) ?? FACILITY_LAYERS[0];
          return { id: f.id, lat: f.lat, lng: f.lng, tone: layer.tone, Icon: layer.Icon, label: f.name };
        }),
    [facilities, facilityTypes],
  );

  const roadRoutes = useMemo(() => {
    if (!showRoads) return [];
    return segments.map((s) => {
      const colour =
        s.closure_status === "closed_confirmed"
          ? "hsl(var(--risk-severe))"
          : s.closure_status === "restricted" || s.traffic_level === "severe"
            ? "hsl(var(--risk-elevated))"
            : s.traffic_level === "moderate"
              ? "hsl(var(--risk-caution))"
              : "hsl(var(--border))";
      return {
        id: s.id,
        points: [
          { lat: s.from_lat, lng: s.from_lng },
          { lat: s.to_lat, lng: s.to_lng },
        ],
        color: colour,
        width: s.closure_status === "closed_confirmed" ? 3 : 2,
        dimmed: false,
      };
    });
  }, [segments, showRoads]);

  const hazardCircles = selected?.radius_km
    ? [
        {
          id: "selected-extent",
          lat: selected.lat,
          lng: selected.lng,
          radiusKm: selected.radius_km,
          className: "text-risk-elevated/15",
          strokeClassName: "stroke-risk-elevated/60",
        },
      ]
    : [];

  const legendItems = [
    ...HAZARD_TYPES.map((h) => ({
      key: h.key,
      label: hazardLabel(h.key, lang),
      tone: h.tone,
      shape: h.key === "closure" ? "diamond" : h.key === "damaged_road" ? "square" : "circle",
      active: types.length === 0 || types.includes(h.key),
      available: (data?.counts?.by_type?.[h.key] ?? 0) > 0,
      note: `${data?.counts?.by_type?.[h.key] ?? 0} record(s) in this selection`,
    })),
    ...FACILITY_LAYERS.map((f) => ({
      key: f.key,
      label: t(f.labelKey),
      tone: f.tone,
      shape: "circle",
      active: facilityTypes.includes(f.key),
      available: facilities.some((x) => x.facility_type === f.key),
      note: `${facilities.filter((x) => x.facility_type === f.key).length} in directory`,
    })),
    {
      key: "roads",
      label: t("legend.roads"),
      tone: "unknown",
      shape: "line",
      active: showRoads,
      available: segments.length > 0,
      note: "internal corridor graph",
    },
    {
      key: "traffic",
      label: t("legend.traffic"),
      tone: "caution",
      shape: "line",
      active: false,
      available: false,
      note: "no traffic layer connected",
    },
  ];

  const onToggleLayer = (key, next) => {
    if (HAZARD_TYPES.some((h) => h.key === key)) {
      setTypes((list) => (next ? (list.includes(key) ? list : [...list, key]) : list.filter((v) => v !== key)));
      return;
    }
    if (FACILITY_LAYERS.some((f) => f.key === key)) {
      setFacilityTypes((list) => (next ? [...new Set([...list, key])] : list.filter((v) => v !== key)));
      return;
    }
    if (key === "roads") setShowRoads(next);
  };

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col lg:flex-row">
      <aside
        className={
          "order-2 w-full shrink-0 overflow-y-auto border-t border-border bg-surface-1/40 p-3 lg:order-1 lg:h-[calc(100vh-57px)] lg:w-[330px] lg:border-r lg:border-t-0 " +
          (panelsOpen ? "" : "hidden lg:block")
        }
      >
        <div className="space-y-3">
          <Panel title="Search and filter" icon={Layers} defaultOpen>
            <div className="space-y-3">
              <PlaceSearch
                label={t("common.search")}
                value={null}
                onSelect={(p) => {
                  if (p) {
                    setView({ lat: p.lat, lng: p.lng, zoom: 10 });
                    if (p.district) setDistrict(p.district);
                  }
                }}
                district={district}
                placeholder="Search a district, city or landmark"
              />
              <div>
                <label className="label-xs">{t("common.district")}</label>
                <div className="mt-1.5">
                  <DistrictSelect value={district} onChange={setDistrict} />
                </div>
              </div>
              <div>
                <p className="label-xs">Hazard classes</p>
                <DisasterTypeSelect selected={types} onToggle={toggleType} className="mt-2" />
              </div>
              <div>
                <p className="label-xs">Data classes</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { key: "observed", label: t("common.observed") },
                    { key: "official", label: t("common.official") },
                    { key: "forecast", label: t("common.forecast") },
                    { key: "historical", label: "Historical observation" },
                    { key: "simulated", label: t("common.simulated") },
                  ].map((c) => {
                    const on = classes.includes(c.key);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggleClass(c.key)}
                        aria-pressed={on}
                        className={
                          "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                          (on ? "border-primary/60 bg-primary/12 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                        }
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {classes.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Showing every data class, including demonstration records.
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <Panel title={t("legend.title")} icon={Layers} defaultOpen>
            <Legend items={legendItems} onToggle={onToggleLayer} />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              A layer with no records is labelled “0 records” rather than drawn empty, and no district is presented as
              having live monitoring in this build.
            </p>
          </Panel>

          <Panel title="Snapshot" icon={Activity} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Hazards" value={data?.counts?.total ?? 0} tone="severe" />
              <StatCard label="Facilities" value={facilities.length} tone="low" />
              <StatCard label="Road segments" value={segments.length} tone="muted" />
              <StatCard label="Demonstration" value={hazards.filter((h) => h.is_demonstration).length} tone="elevated" />
            </div>
            <p className="mono mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
              snapshot {data?.snapshot_at ? data.snapshot_at.slice(11, 19) : "—"} UTC
              {data?.network_note ? ` · ${data.network_note}` : ""}
            </p>
          </Panel>
        </div>
      </aside>

      <div className="relative order-1 min-h-[58vh] flex-1 lg:order-2 lg:min-h-0">
        <SmartMap
          center={view}
          zoom={view.zoom}
          markers={[...hazardMarkers, ...facilityMarkers]}
          routes={roadRoutes}
          circles={hazardCircles}
          onViewChange={setView}
          onMapClick={(p) => setView((v) => ({ ...v, lat: p.lat, lng: p.lng }))}
          className="h-[58vh] w-full rounded-none border-0 lg:h-[calc(100vh-57px)]"
          ariaLabel="Tamil Nadu multi-hazard map"
        />

        <button
          type="button"
          onClick={() => setPanelsOpen((v) => !v)}
          className="absolute left-3 top-3 z-40 hidden items-center gap-2 rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-[11.5px] text-muted-foreground backdrop-blur transition-colors hover:text-primary lg:flex"
        >
          {panelsOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          {panelsOpen ? "Hide panels" : "Show panels"}
        </button>

        <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center gap-2 lg:right-auto lg:max-w-md">
          <span className="chip border-risk-elevated/40 bg-background/90 text-risk-elevated backdrop-blur">
            <TriangleAlert className="h-3 w-3" />
            demonstration records · no live monitoring
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 bg-background/90 backdrop-blur"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (isFetching ? "animate-spin" : "")} />
            {t("common.refresh")}
          </Button>
          {isLoading && <span className="chip bg-background/90">loading snapshot…</span>}
          {isError && (
            <span className="chip border-risk-severe/40 bg-background/90 text-risk-severe">
              {String(error?.message ?? "load failed").slice(0, 80)}
            </span>
          )}
        </div>

        {selected && (
          <div className="absolute bottom-3 right-3 z-40 w-[min(360px,calc(100%-24px))] rounded-xl border border-border bg-background/95 p-4 backdrop-blur lg:top-16">
            <HazardDetail
              hazard={selected}
              lang={lang}
              onClose={() => setSelected(null)}
              onFocus={(h) => setView({ lat: h.lat, lng: h.lng, zoom: 11 })}
            />
          </div>
        )}
      </div>

      <aside className="order-3 hidden w-[320px] shrink-0 overflow-y-auto border-l border-border bg-surface-1/40 p-3 xl:block lg:h-[calc(100vh-57px)]">
        <div className="space-y-3">
          <Panel
            title={`${t("mod.alerts.title")} · ${district === "all" ? t("common.allDistricts") : districtLabel(district, lang)}`}
            defaultOpen
          >
            {(data?.alerts ?? []).length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                No alert records for this selection. No official warning feed is connected, so no official alert is
                claimed.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {(data?.alerts ?? []).slice(0, 4).map((a) => (
                  <li key={a.id} className="border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
                    <p className="text-[12.5px] font-medium">{a.title}</p>
                    <p className="mono mt-0.5 text-[10.5px] text-muted-foreground">
                      {a.is_official ? "official" : "not official"} · {a.data_class} · expires{" "}
                      {a.expires_at ? String(a.expires_at).slice(0, 10) : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Shelters and services in view" defaultOpen={false}>
            <ul className="space-y-2 text-[12px]">
              {facilities.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{f.name}</span>
                    <span className="block text-[10.5px] text-muted-foreground">
                      {String(f.facility_type).replace(/_/g, " ")} · capacity{" "}
                      {f.capacity_status === "unknown" ? "not available" : f.capacity_status}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setView({ lat: f.lat, lng: f.lng, zoom: 12 })}
                    className="shrink-0 text-[10.5px] text-primary hover:underline"
                  >
                    {t("common.viewOnMap")}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("mod.sources.title")} defaultOpen={false}>
            <ul className="space-y-2 text-[11.5px] text-muted-foreground">
              {(data?.sources ?? []).slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{s.name}</span>
                    <span className="mono block text-[10px]">{String(s.access_status).replace(/_/g, " ")}</span>
                  </span>
                  <span className="mono shrink-0 text-[10px]">
                    {s.last_success_at ? String(s.last_success_at).slice(11, 16) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10.5px] leading-relaxed">{data?.google?.notice}</p>
          </Panel>
        </div>
      </aside>
    </div>
  );
}