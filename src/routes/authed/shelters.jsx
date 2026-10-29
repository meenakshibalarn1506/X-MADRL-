import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import SmartMap from "@/components/map/SmartMap";
import DistrictSelect from "@/components/controls/DistrictSelect";
import FacilityList from "@/components/shelters/FacilityList";
import FacilityDetail from "@/components/shelters/FacilityDetail";
import { listShelterDirectory } from "@/lib/server-fns";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/shelters")({
  head: () => ({
    meta: [
      { title: "Shelters and Emergency Services — X-MADRL" },
      { name: "description", content: "Shelter, hospital and relief centre directory with verification status." },
    ],
  }),
  component: SheltersPage,
});

const TYPES = [
  { key: "all", label: "All facilities" },
  { key: "shelter", label: "Shelters" },
  { key: "relief_centre", label: "Relief centres" },
  { key: "hospital", label: "Hospitals" },
  { key: "fire_station", label: "Fire stations" },
  { key: "police_station", label: "Police stations" },
  { key: "ambulance_depot", label: "Ambulance depots" },
];

const TONE = {
  shelter: "low",
  relief_centre: "caution",
  hospital: "primary",
  fire_station: "elevated",
  police_station: "primary",
  ambulance_depot: "elevated",
};

function SheltersPage() {
  const { t } = useLanguage();
  const fn = useServerFn(listShelterDirectory);
  const [district, setDistrict] = useState("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState({ lat: 10.85, lng: 78.55, zoom: 7 });
  const [selectedFacility, setSelectedFacility] = useState(null);

  const query = useQuery({
    queryKey: ["facilities", district, type, q],
    queryFn: () => fn({ data: { district, facility_type: type, q: q || undefined } }),
  });

  const facilities = query.data?.facilities ?? [];
  const markers = facilities
    .filter((f) => f.lat != null)
    .map((f) => ({
      id: f.id,
      lat: f.lat,
      lng: f.lng,
      tone: TONE[f.facility_type] ?? "primary",
      label: f.name,
      selected: selectedFacility?.id === f.id,
      onClick: () => setSelectedFacility(f),
    }));

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[1fr_420px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t("mod.shelters.title")}</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {facilities.length} facilities in this selection. Occupancy is only shown where a source actually reported
              it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[190px]">
              <DistrictSelect value={district} onChange={setDistrict} />
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
            >
              {TYPES.map((tp) => (
                <option key={tp.key} value={tp.key}>
                  {tp.label}
                </option>
              ))}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or address"
              className="h-9 w-[190px] rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
            />
            <Button size="sm" variant="outline" className="gap-2" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={"h-3.5 w-3.5 " + (query.isFetching ? "animate-spin" : "")} />
              {t("common.refresh")}
            </Button>
          </div>
        </div>

        <SmartMap
          center={view}
          zoom={view.zoom}
          markers={markers}
          onViewChange={setView}
          className="h-[44vh] w-full overflow-hidden rounded-xl border border-border"
          ariaLabel="Shelter and emergency service locations"
        />

        {selectedFacility && (
          <FacilityDetail
            facility={selectedFacility}
            onClose={() => setSelectedFacility(null)}
            onFocus={(f) => setView({ lat: f.lat, lng: f.lng, zoom: 14 })}
          />
        )}

        <p className="flex items-start gap-2 rounded-lg border border-risk-caution/40 bg-risk-caution/10 px-3 py-2.5 text-[12px] leading-relaxed text-risk-caution">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          No official shelter directory is connected. The facilities shown are demonstration stubs marked
          “unverified demonstration”, listed so the workflow is complete. Capacities are deliberately left unknown rather
          than invented.
        </p>

        {query.isLoading ? (
          <p className="text-[12.5px] text-muted-foreground">Loading the directory…</p>
        ) : query.isError ? (
          <p className="text-[12.5px] text-risk-severe">
            The directory could not be loaded: {String(query.error?.message ?? "").slice(0, 140)}
          </p>
        ) : (
          <Panel title="Directory" icon={Shield} defaultOpen>
            <FacilityList
              facilities={facilities}
              onFocus={(f) => setView({ lat: f.lat, lng: f.lng, zoom: 13 })}
            />
          </Panel>
        )}
      </div>

      <aside className="space-y-3">
        <Panel title="How to use this directory" defaultOpen>
          <ul className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
            <li>· A facility with “capacity not available” has no operator feed reporting occupancy. Treat it as unknown, not as free space.</li>
            <li>· “Accessibility not known” means no source has confirmed step-free access.</li>
            <li>· Verification status tells you whether an official source or an administrator confirmed the record.</li>
            <li>· During an evacuation, follow the shelter instructions given by the district administration, which may differ from this directory.</li>
          </ul>
        </Panel>

        <Panel title="Selected facilities" defaultOpen={false}>
          <FacilityList
            facilities={facilities.slice(0, 8)}
            compact
            onFocus={(f) => setView({ lat: f.lat, lng: f.lng, zoom: 13 })}
          />
        </Panel>
      </aside>
    </div>
  );
}