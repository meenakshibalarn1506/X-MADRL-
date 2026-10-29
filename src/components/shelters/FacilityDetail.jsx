import { Cross, Home, Shield, Siren, Accessibility, PawPrint, MapPin, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourceLine } from "@/components/cc/Badges";
import { districtLabel } from "@/lib/tn";

const TYPE = {
  shelter: { label: "Shelter", Icon: Home },
  hospital: { label: "Hospital", Icon: Cross },
  relief_centre: { label: "Relief centre", Icon: Shield },
  fire_station: { label: "Fire station", Icon: Siren },
  police_station: { label: "Police station", Icon: Shield },
  ambulance_depot: { label: "Ambulance depot", Icon: Siren },
};

const CAPACITY = {
  unknown: { label: "Capacity not available", className: "border-border bg-surface-2 text-muted-foreground" },
  available: { label: "Capacity reported available", className: "border-risk-low/40 bg-risk-low/10 text-risk-low" },
  near_full: { label: "Nearly full", className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution" },
  full: { label: "Full", className: "border-risk-severe/40 bg-risk-severe/10 text-risk-severe" },
};

/**
 * Detail panel for a selected shelter/emergency-service facility.
 * Shown when a map marker is clicked. Shows the actual record, not sample data.
 */
export default function FacilityDetail({ facility, onClose, onFocus }) {
  if (!facility) return null;
  const meta = TYPE[facility.facility_type] ?? TYPE.shelter;
  const cap = CAPACITY[facility.capacity_status] ?? CAPACITY.unknown;

  return (
    <div className="rounded-xl border border-primary/40 bg-surface-1/80 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <meta.Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-[14px] font-semibold">{facility.name}</h3>
            <span className="chip">{meta.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Close details"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-2 text-[12px] text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {facility.district ? districtLabel(facility.district) : "District not recorded"}
            {facility.address ? ` · ${facility.address}` : ""}
          </span>
        </p>
        <p className="mono text-[11px]">
          {facility.lat?.toFixed(4)}, {facility.lng?.toFixed(4)}
        </p>
        {facility.contact && (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {facility.contact}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={"chip " + cap.className}>{cap.label}</span>
        {facility.capacity ? <span className="chip">declared capacity {facility.capacity}</span> : null}
        {facility.accessible === "yes" && (
          <span className="chip border-risk-low/40 bg-risk-low/10 text-risk-low">
            <Accessibility className="h-3 w-3" />
            step-free access
          </span>
        )}
        {facility.accessible === "unknown" && <span className="chip">accessibility not known</span>}
        {facility.pet_friendly === "yes" && (
          <span className="chip">
            <PawPrint className="h-3 w-3" />
            pets allowed
          </span>
        )}
      </div>

      {facility.capacity_status === "unknown" && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          No operator feed reports occupancy for this facility, so this app does not claim space is free.
        </p>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <SourceLine
          source={facility.source}
          updatedAt={facility.last_verified}
          extra={`verification: ${String(facility.verification_status ?? "unknown").replace(/_/g, " ")}`}
        />
        {facility.operator && <p className="mt-1 text-[11px] text-muted-foreground">Operator: {facility.operator}</p>}
      </div>

      {onFocus && (
        <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => onFocus(facility)}>
          <MapPin className="h-3.5 w-3.5" />
          Centre on map
        </Button>
      )}
    </div>
  );
}