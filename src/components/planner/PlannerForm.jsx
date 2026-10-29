import { Footprints, Bike, Car, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlaceSearch from "@/components/controls/PlaceSearch";
import DistrictSelect from "@/components/controls/DistrictSelect";
import { useLanguage } from "@/lib/i18n";
import { TRAVEL_MODES, PRIORITY_PRESETS } from "@/lib/risk";

const MODE_ICON = { walking: Footprints, cycling: Bike, driving: Car };

const NEEDS = [
  { key: "pets", labelKey: "planner.pets" },
  { key: "luggage", labelKey: "planner.luggage" },
  { key: "children", labelKey: "planner.children" },
  { key: "older_adults", labelKey: "planner.olderAdults" },
  { key: "mobility_needs", labelKey: "planner.mobility" },
];

const DEST_NEEDS = [
  { key: "any", labelKey: "planner.anyDest" },
  { key: "shelter", label: "Shelter" },
  { key: "relief_centre", label: "Relief centre" },
  { key: "hospital", label: "Hospital" },
  { key: "fire_station", label: "Fire station" },
  { key: "police_station", label: "Police station" },
];

export default function PlannerForm({
  form,
  setForm,
  onPlan,
  busy,
  district,
  onDistrictChange,
  pinTarget,
  onPinTargetChange,
}) {
  const { t, lang } = useLanguage();

  const setPref = (key, value) => setForm((f) => ({ ...f, preferences: { ...f.preferences, [key]: value } }));

  const canPlan = Boolean(form.origin) && (Boolean(form.destination) || form.preferences.destination_need !== "any");

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <PlaceSearch
          label={t("planner.start")}
          value={form.origin}
          onSelect={(p) => setForm((f) => ({ ...f, origin: p }))}
          district={district}
          placeholder="Search your start point"
          showCurrentLocation
        />
        <PlaceSearch
          label={t("planner.destination")}
          value={form.destination}
          onSelect={(p) => setForm((f) => ({ ...f, destination: p }))}
          district={district}
          placeholder="Search a destination, shelter or landmark"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-2">
          <span className="label-xs">Map click sets</span>
          <div className="flex gap-1">
            {[
              { key: "origin", label: t("planner.start") },
              { key: "destination", label: t("planner.destination") },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => onPinTargetChange(o.key)}
                aria-pressed={pinTarget === o.key}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                  (pinTarget === o.key
                    ? "border-primary/60 bg-primary/12 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-xs">{t("common.district")}</label>
          <div className="mt-1.5">
            <DistrictSelect value={district} onChange={onDistrictChange} />
          </div>
        </div>
      </div>

      <div>
        <p className="label-xs">{t("planner.mode")}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {TRAVEL_MODES.map((m) => {
            const Icon = MODE_ICON[m.key];
            const on = form.mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, mode: m.key }))}
                aria-pressed={on}
                className={
                  "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[12px] transition-colors " +
                  (on
                    ? "border-primary/60 bg-primary/12 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")
                }
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {lang === "ta" ? m.ta : m.en}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label-xs">{t("planner.needs")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {NEEDS.map((n) => {
            const on = Boolean(form.preferences[n.key]);
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => setPref(n.key, !on)}
                aria-pressed={on}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                  (on ? "border-primary/60 bg-primary/12 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {t(n.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <label className="label-xs" htmlFor="max-walk">
            {t("planner.maxWalk")}
          </label>
          <input
            id="max-walk"
            type="number"
            min="0.5"
            max="40"
            step="0.5"
            value={form.preferences.max_walk_km}
            onChange={(e) => setPref("max_walk_km", Number(e.target.value))}
            className="mono mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="label-xs" htmlFor="dest-need">
          {t("planner.destType")}
        </label>
        <select
          id="dest-need"
          value={form.preferences.destination_need}
          onChange={(e) => setPref("destination_need", e.target.value)}
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
        >
          {DEST_NEEDS.map((d) => (
            <option key={d.key} value={d.key} className="bg-surface-2 text-foreground">
              {d.labelKey ? t(d.labelKey) : d.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="label-xs">{t("planner.priorities")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(PRIORITY_PRESETS).map(([key, preset]) => {
            const on = form.preferences.priority === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPref("priority", key)}
                aria-pressed={on}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                  (on ? "border-primary/60 bg-primary/12 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {lang === "ta" ? preset.ta : preset.en}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Button className="w-full gap-2 font-semibold" onClick={onPlan} disabled={!canPlan || busy}>
          {busy ? t("common.loading") : t("planner.plan")}
        </Button>
        {!canPlan && (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-caution" />
            Choose a start point and a destination, or pick them from the map.
          </p>
        )}
      </div>
    </div>
  );
}