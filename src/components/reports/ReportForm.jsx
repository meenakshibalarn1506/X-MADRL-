import { useState } from "react";
import { MapPin, Loader2, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import DistrictSelect from "@/components/controls/DistrictSelect";
import StarRating from "@/components/reports/StarRating";
import MultiPhotoUpload from "@/components/reports/MultiPhotoUpload";
import { HAZARD_TYPES } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

const SEVERITIES = [
  { key: "low", label: "Low — minor inconvenience" },
  { key: "caution", label: "Caution — passable with care" },
  { key: "elevated", label: "Elevated — significant obstruction" },
  { key: "severe", label: "Severe — dangerous or impassable" },
];

export default function ReportForm({ position, onPositionChange, district, onDistrictChange, onSubmit, busy }) {
  const { lang } = useLanguage();
  const [form, setForm] = useState({
    title: "",
    place_name: "",
    hazard_type: "flood",
    severity: "caution",
    description: "",
    landmark: "",
    road_blocked: false,
    water_depth_m: "",
    rating: 0,
  });
  const [photoUris, setPhotoUris] = useState([]);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const capturePosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onPositionChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          label: "Device position",
        }),
      () => onPositionChange(null),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const submit = () => {
    setError(null);
    if (!position) {
      setError("A location is required so the report can be placed. Use your device position or pick a point on the map.");
      return;
    }
    if (form.title.trim().length < 3 || form.title.trim().length > 140) {
      setError("Give the report a title of 3 to 140 characters.");
      return;
    }
    onSubmit({
      title: form.title.trim(),
      place_name: form.place_name.trim() || undefined,
      hazard_type: form.hazard_type,
      severity: form.severity,
      description: form.description || undefined,
      district: district === "all" ? undefined : district,
      landmark: form.landmark || undefined,
      lat: position.lat,
      lng: position.lng,
      position_accuracy_m: position.accuracy ?? undefined,
      observed_at: new Date().toISOString(),
      photo_uris: photoUris.length > 0 ? photoUris : undefined,
      water_depth_m: form.water_depth_m === "" ? undefined : Number(form.water_depth_m),
      road_blocked: form.road_blocked,
      rating: form.rating > 0 ? form.rating : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-risk-severe/40 bg-risk-severe/10 px-3 py-2 text-[12px] text-risk-severe">{error}</p>}

      <div>
        <label className="label-xs" htmlFor="report-title">
          What did you see?
        </label>
        <input
          id="report-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={140}
          placeholder="Short title, for example “Road flooded near bus stand”"
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground">Required — 3 to 140 characters</span>
          <span className={"mono text-[10.5px] " + (form.title.length > 130 ? "text-risk-caution" : "text-muted-foreground")}>
            {form.title.length}/140
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-xs" htmlFor="report-place">
            Place or facility name
          </label>
          <input
            id="report-place"
            value={form.place_name}
            onChange={(e) => set("place_name", e.target.value)}
            maxLength={200}
            placeholder="e.g. Tambaram Bus Stand, Rajiv Gandhi Hospital"
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="label-xs">Your rating (optional)</label>
          <div className="mt-1.5 flex h-9 items-center">
            <StarRating value={form.rating} onChange={(v) => set("rating", v)} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-xs" htmlFor="report-type">
            Hazard class
          </label>
          <select
            id="report-type"
            value={form.hazard_type}
            onChange={(e) => set("hazard_type", e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          >
            {HAZARD_TYPES.map((h) => (
              <option key={h.key} value={h.key}>
                {lang === "ta" ? h.ta : h.en}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-xs" htmlFor="report-severity">
            How bad is it?
          </label>
          <select
            id="report-severity"
            value={form.severity}
            onChange={(e) => set("severity", e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          >
            {SEVERITIES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label-xs" htmlFor="report-desc">
          Details
        </label>
        <textarea
          id="report-desc"
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What is affected, how deep or how blocked, and anything a responder should know."
          className="mt-1.5 w-full rounded-md border border-input bg-surface-1 px-2.5 py-2 text-[13px] outline-none focus:border-primary"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-xs" htmlFor="report-landmark">
            Nearest landmark
          </label>
          <input
            id="report-landmark"
            value={form.landmark}
            onChange={(e) => set("landmark", e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="label-xs" htmlFor="report-depth">
            Water depth (m), if known
          </label>
          <input
            id="report-depth"
            type="number"
            min="0"
            step="0.1"
            value={form.water_depth_m}
            onChange={(e) => set("water_depth_m", e.target.value)}
            className="mono mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="label-xs" htmlFor="report-district">
          District
        </label>
        <div className="mt-1.5">
          <DistrictSelect id="report-district" value={district} onChange={onDistrictChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-1/60 px-3 py-3">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="mono min-w-0 flex-1 text-[12px] text-muted-foreground">
          {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}${position.accuracy ? ` · ±${Math.round(position.accuracy)} m` : ""}` : "No position selected"}
        </span>
        <Button size="sm" variant="outline" onClick={capturePosition}>
          Use device position
        </Button>
      </div>

      <MultiPhotoUpload onChange={setPhotoUris} />

      <label className="flex items-center gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={form.road_blocked}
          onChange={(e) => set("road_blocked", e.target.checked)}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        The road is blocked or impassable
      </label>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-caution" />
        A report is not a confirmed hazard. It is stored with the status “pending” and is only shown as verified after an
        administrator reviews it. Nothing you submit can close a road or trigger an official evacuation order.
      </p>

      <Button onClick={submit} disabled={busy} className="w-full gap-2 font-semibold">
        <Send className="h-4 w-4" />
        {busy ? "Submitting" : "Submit report for verification"}
      </Button>
    </div>
  );
}