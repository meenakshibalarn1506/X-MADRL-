import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, TriangleAlert, Bookmark, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlannerForm from "@/components/planner/PlannerForm";
import RouteCards from "@/components/planner/RouteCards";
import RouteMap from "@/components/planner/RouteMap";
import NavigationSteps from "@/components/planner/NavigationSteps";
import Panel from "@/components/cc/Panel";
import FacilityList from "@/components/shelters/FacilityList";
import { planJourney, listShelterDirectory } from "@/lib/server-fns";
import { PRIORITY_PRESETS } from "@/lib/risk";
import { haversineKm } from "@/lib/geo";
import { saveJourney } from "@/lib/journeyStore";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/planner")({
  head: () => ({
    meta: [
      { title: "Safe Route Planner — X-MADRL" },
      { name: "description", content: "Risk-aware evacuation routing for Tamil Nadu with alternative route comparison." },
    ],
  }),
  component: PlannerPage,
});

const EMPTY_PREFS = {
  pets: false,
  luggage: false,
  children: false,
  older_adults: false,
  mobility_needs: false,
  max_walk_km: 6,
  destination_need: "any",
  priority: "balanced",
};

function PlannerPage() {
  const { t } = useLanguage();
  const planFn = useServerFn(planJourney);
  const facilityFn = useServerFn(listShelterDirectory);

  const [district, setDistrict] = useState("all");
  const [pinTarget, setPinTarget] = useState("origin");
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [journey, setJourney] = useState(null);
  const [saveNote, setSaveNote] = useState(null);
  const [form, setForm] = useState({
    origin: null,
    destination: null,
    mode: "driving",
    preferences: { ...EMPTY_PREFS },
  });

  const facilitiesQuery = useQuery({
    queryKey: ["facilities", district],
    queryFn: () => facilityFn({ data: { district } }),
  });

  const mutation = useMutation({
    mutationFn: (payload) => planFn({ data: payload }),
    onSuccess: (res, variables) => {
      setJourney(res);
      setSelectedKey(res.recommended_key ?? res.candidates?.[0]?.key ?? null);
      setSelectedStep(null);
      setIsNavigating(false);
      saveJourney(res);
      if (variables?.persist) {
        setSaveNote(res.saved_plan_id ? "Plan saved to your account." : "Plan computed, but it could not be saved.");
      }
    },
  });

  const resolveDestination = () => {
    if (form.destination) return form.destination;
    const need = form.preferences.destination_need;
    if (need === "any" || !form.origin) return null;
    const pool = (facilitiesQuery.data?.facilities ?? []).filter((f) => f.facility_type === need);
    const nearest = pool
      .map((f) => ({ f, d: haversineKm(form.origin, { lat: f.lat, lng: f.lng }) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!nearest) return null;
    return { label: nearest.f.name, lat: nearest.f.lat, lng: nearest.f.lng };
  };

  const runPlan = ({ persist = false, weights } = {}) => {
    setSaveNote(null);
    const preset = PRIORITY_PRESETS[form.preferences.priority] ?? PRIORITY_PRESETS.balanced;
    const destination = resolveDestination();
    if (!form.origin || !destination) {
      setSaveNote(
        form.preferences.destination_need !== "any"
          ? "No facility of that type is in the directory for this district, so a destination is still needed."
          : "Choose a start point and a destination first.",
      );
      return;
    }
    mutation.mutate({
      origin: form.origin,
      destination,
      mode: form.mode,
      preferences: form.preferences,
      weights: weights ?? preset.weights,
      persist,
    });
  };

  const recommended = journey?.candidates?.find((c) => c.key === journey.recommended_key) ?? journey?.candidates?.[0];
  const selectedRoute = journey?.candidates?.find((c) => c.key === selectedKey) ?? recommended;
  const navSteps = selectedRoute?.steps ?? [];
  const highlightedPoints = selectedStep != null ? (navSteps[selectedStep]?.points ?? []) : [];

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr]">
      <div className="space-y-3">
        <Panel title={t("mod.planner.title")} subtitle={t("mod.planner.sub")} icon={Gauge} defaultOpen>
          <PlannerForm
            form={form}
            setForm={setForm}
            onPlan={() => runPlan({})}
            busy={mutation.isPending}
            district={district}
            onDistrictChange={setDistrict}
            pinTarget={pinTarget}
            onPinTargetChange={setPinTarget}
          />
        </Panel>

        {saveNote && (
          <p className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            {saveNote}
          </p>
        )}

        {mutation.isError && (
          <p className="rounded-lg border border-risk-severe/40 bg-risk-severe/10 px-3 py-2 text-[12px] text-risk-severe">
            {String(mutation.error?.message ?? "The route could not be computed.").slice(0, 200)}
          </p>
        )}

        {journey && (
          <Panel title="Engine and data" icon={Info} defaultOpen={false}>
            <ul className="mono space-y-1.5 text-[11.5px] text-muted-foreground">
              <li>engine: {journey.engine} ({journey.engine_version})</li>
              <li>
                graph: {journey.network.nodes} nodes · {journey.network.segments} segments
                {journey.network.demonstration ? " · demonstration network" : ""}
              </li>
              <li>confirmed closures removed from the graph: {journey.network.hard_closed_removed}</li>
              <li>snapshot: {journey.data_snapshot_at?.slice(0, 19).replace("T", " ")} UTC</li>
              <li>google routes api: {journey.google?.configured ? "configured" : "not configured"}</li>
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">{journey.engine_notice}</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{journey.google?.notice}</p>
            {journey.origin_snap && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                Start snapped to network node {journey.origin_snap.label} ({journey.origin_snap.distance_km} km) ·
                destination snapped to {journey.destination_snap?.label} ({journey.destination_snap?.distance_km} km).
              </p>
            )}
            {journey.soft_closures?.length > 0 && (
              <div className="mt-3">
                <p className="label-xs">Closures treated as penalties, not constraints</p>
                <ul className="mt-1.5 space-y-1.5 text-[11.5px] text-muted-foreground">
                  {journey.soft_closures.slice(0, 4).map((c, i) => (
                    <li key={i}>· {c.road_name}: {c.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {journey.hard_closed?.length > 0 && (
              <div className="mt-3">
                <p className="label-xs">Authoritative closures applied as routing constraints</p>
                <ul className="mt-1.5 space-y-1.5 text-[11.5px] text-muted-foreground">
                  {journey.hard_closed.map((c, i) => (
                    <li key={i}>
                      · {c.road_name} ({c.from_name}–{c.to_name}) · confidence {Math.round((c.confidence ?? 0) * 100)}% ·
                      source {c.source}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
          <div className="space-y-2">
            <RouteMap
              journey={journey}
              selectedKey={selectedKey}
              autoFit
              highlightedPoints={highlightedPoints}
              className="h-[420px] sm:h-[500px] overflow-hidden rounded-xl border border-border"
              onMapClick={(p) =>
                setForm((f) =>
                  pinTarget === "origin"
                    ? { ...f, origin: { label: `Pin ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`, lat: p.lat, lng: p.lng } }
                    : { ...f, destination: { label: `Pin ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`, lat: p.lat, lng: p.lng } },
                )
              }
            />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Clicking the map sets the <span className="text-foreground">{pinTarget === "origin" ? t("planner.start") : t("planner.destination")}</span>.
              Change which one it sets in the form.
            </p>
          </div>

          <div className="space-y-3">
            {journey && (
              <>
                <RouteCards journey={journey} selectedKey={selectedKey} onSelect={setSelectedKey} />

                {navSteps.length > 0 && (
                  <NavigationSteps
                    steps={navSteps}
                    selectedStep={selectedStep}
                    onSelectStep={setSelectedStep}
                    isNavigating={isNavigating}
                    onStartNav={() => { setIsNavigating(true); setSelectedStep(0); }}
                    onNextStep={() => setSelectedStep((s) => Math.min((s ?? 0) + 1, navSteps.length - 1))}
                    onPrevStep={() => setSelectedStep((s) => Math.max((s ?? 0) - 1, 0))}
                    onEndNav={() => { setIsNavigating(false); setSelectedStep(null); }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {!journey && !mutation.isPending && (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <TriangleAlert className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-[13px] font-semibold">No route computed yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
              Choose a start and destination, set your travel mode and needs, then plan. The engine returns several
              candidate routes and ranks them against the hazards, closures and uncertainty in the data.
            </p>
          </div>
        )}

        {mutation.isPending && (
          <p className="rounded-lg border border-border bg-surface-1/60 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
            Computing candidate routes…
          </p>
        )}

        {journey && (
          <>
            {journey.ok && recommended && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => runPlan({ persist: true })}>
                  <Bookmark className="h-3.5 w-3.5" />
                  Save this plan
                </Button>
                <span className="text-[11.5px] text-muted-foreground">
                  Plans are only stored when you save them. Location history is not kept by default.
                </span>
              </div>
            )}

            {(journey.facilities_near_route ?? []).length > 0 && (
              <Panel title="Facilities within 6 km of the recommended route" defaultOpen={false}>
                <FacilityList facilities={journey.facilities_near_route} compact />
                {journey.preferences?.destination_need && journey.preferences.destination_need !== "any" && (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    Requested destination type: {journey.preferences.destination_need.replace(/_/g, " ")} ·{" "}
                    {(journey.destination_served ?? []).length} matching facilit
                    {(journey.destination_served ?? []).length === 1 ? "y" : "ies"} near this route. Capacity is only
                    stated where a source reported it.
                  </p>
                )}
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}