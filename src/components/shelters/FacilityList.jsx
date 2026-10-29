import { Cross, Home, Shield, Siren, Accessibility, PawPrint } from "lucide-react";
import { districtLabel } from "@/lib/tn";
import { SourceLine } from "@/components/cc/Badges";

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
 * Facility directory. Capacity is only stated where a source actually reported
 * it — otherwise the card says capacity is not available rather than guessing.
 */
export default function FacilityList({ facilities = [], onFocus, compact = false }) {
  if (facilities.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">
        No facilities match this selection. The directory is a demonstration stub until an official shelter source is
        connected.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {facilities.map((f) => {
        const meta = TYPE[f.facility_type] ?? TYPE.shelter;
        const cap = CAPACITY[f.capacity_status] ?? CAPACITY.unknown;
        return (
          <li key={f.id} className="rounded-xl border border-border bg-surface-1/60 p-3.5">
            <div className="flex items-start gap-3">
              <meta.Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-semibold">{f.name}</h3>
                  <span className="chip">{meta.label}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {districtLabel(f.district) }
                  {f.address ? ` · ${f.address}` : ""}
                  {f.distance_to_route_km != null ? ` · ${f.distance_to_route_km} km from route` : ""}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={"chip " + cap.className}>{cap.label}</span>
                  {f.capacity ? (
                    <span className="chip">declared capacity {f.capacity}</span>
                  ) : null}
                  {f.accessible === "yes" && (
                    <span className="chip border-risk-low/40 bg-risk-low/10 text-risk-low">
                      <Accessibility className="h-3 w-3" />
                      step-free access
                    </span>
                  )}
                  {f.accessible === "unknown" && <span className="chip">accessibility not known</span>}
                  {f.pet_friendly === "yes" && (
                    <span className="chip">
                      <PawPrint className="h-3 w-3" />
                      pets allowed
                    </span>
                  )}
                  {f.pet_friendly !== "yes" && (
                    <span className="chip">pets: not known</span>
                  )}
                </div>

                {f.capacity_status === "unknown" && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    No operator feed reports occupancy for this facility, so this app does not claim space is free.
                  </p>
                )}

                {!compact && (
                  <div className="mt-2">
                    <SourceLine
                      source={f.source}
                      updatedAt={f.last_verified}
                      extra={`verification: ${String(f.verification_status ?? "unknown").replace(/_/g, " ")}`}
                    />
                    {f.contact ? <p className="mono mt-0.5 text-[10.5px] text-muted-foreground">contact: {f.contact}</p> : null}
                  </div>
                )}

                {onFocus && (
                  <button
                    type="button"
                    onClick={() => onFocus(f)}
                    className="mt-2 text-[11.5px] text-primary hover:underline"
                  >
                    Show on map
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}