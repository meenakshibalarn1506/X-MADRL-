import { Clock, MapPin, TriangleAlert, Waves, ExternalLink, ShieldCheck } from "lucide-react";
import { DataClassBadge, SeverityBadge, SourceLine } from "@/components/cc/Badges";
import { districtLabel, hazardLabel } from "@/lib/tn";
import { BAND_LABEL, freshnessOf, FRESHNESS_LABEL } from "@/lib/risk";

export default function HazardDetail({ hazard, lang, onClose, onFocus }) {
  if (!hazard) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
        Select a hazard on the map to see its source, age, verification status and precautions.
      </p>
    );
  }

  const fresh = freshnessOf(hazard.last_update);
  const precautionList = hazard.precautions ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold leading-snug">{hazard.title}</h3>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {hazardLabel(hazard.hazard_type, lang)} · {hazard.district ? districtLabel(hazard.district, lang) : "district not given"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mono shrink-0 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          clear
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <SeverityBadge level={hazard.severity} />
        <DataClassBadge value={hazard.data_class} />
        {hazard.is_demonstration && (
          <span className="chip border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated">demonstration record</span>
        )}
        {hazard.review_status && <span className="chip">{String(hazard.review_status).replace(/_/g, " ")}</span>}
      </div>

      {hazard.description && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">{hazard.description}</p>
      )}

      {hazard.data_class === "simulated" && (
        <p className="flex items-start gap-2 rounded-lg border border-risk-elevated/40 bg-risk-elevated/10 px-3 py-2 text-[11.5px] leading-relaxed text-risk-elevated">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This is a simulated or demonstration record. It does not describe a live emergency anywhere in Tamil Nadu.
        </p>
      )}

      <dl className="grid gap-1.5 text-[11.5px]">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="mono">
            {hazard.lat?.toFixed(4)}, {hazard.lng?.toFixed(4)}
            {hazard.radius_km ? ` · ${hazard.radius_km} km radius` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="mono">
            updated {hazard.last_update ? String(hazard.last_update).slice(0, 16).replace("T", " ") : "—"} ·{" "}
            {FRESHNESS_LABEL[fresh.state]?.en}
          </span>
        </div>
        {hazard.confidence != null && (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="mono">source confidence {Math.round(hazard.confidence * 100)}%</span>
          </div>
        )}
        {hazard.water_depth_m != null && (
          <div className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="mono">reported depth {hazard.water_depth_m} m</span>
          </div>
        )}
      </dl>

      {(hazard.affected_roads ?? []).length > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          Affected roads: {hazard.affected_roads.join(", ")}
        </p>
      )}

      {precautionList.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-2/50 p-3">
          <p className="label-xs">Recommended precautions</p>
          <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            {precautionList.map((p, i) => (
              <li key={i}>· {p}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            General guidance from the recorded source. Follow the district administration if it differs.
          </p>
        </div>
      )}

      <SourceLine
        source={hazard.source}
        updatedAt={hazard.last_update}
        extra={`verification: ${String(hazard.verification_status ?? "unknown").replace(/_/g, " ")} · band: ${BAND_LABEL.severe ? "" : ""}`}
      />

      {hazard.official_warning_url && (
        <a
          href={hazard.official_warning_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Official warning
        </a>
      )}

      {onFocus && (
        <button type="button" onClick={() => onFocus(hazard)} className="text-[11.5px] text-primary hover:underline">
          Centre the map here
        </button>
      )}
    </div>
  );
}