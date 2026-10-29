import { useState } from "react";
import { Check, Image as ImageIcon, Loader2, MapPin, ShieldCheck, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { SeverityBadge } from "@/components/cc/Badges";
import { base44 } from "@/api/base44Client";
import { districtLabel, hazardLabel } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

function Stars({ value }) {
  if (!value || value < 1) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={n <= value ? "h-3 w-3 fill-primary text-primary" : "h-3 w-3 text-muted-foreground/40"} />
      ))}
    </span>
  );
}

const STATUS = {
  pending: { label: "Pending verification", className: "border-risk-caution/40 bg-risk-caution/10 text-risk-caution" },
  verified: { label: "Verified", className: "border-risk-low/40 bg-risk-low/10 text-risk-low" },
  rejected: { label: "Rejected", className: "border-risk-severe/40 bg-risk-severe/10 text-risk-severe" },
  duplicate: { label: "Duplicate", className: "border-border bg-surface-2 text-muted-foreground" },
};

function ReportCard({ report, isAdmin, onReview, busy }) {
  const { lang } = useLanguage();
  const [photoUrls, setPhotoUrls] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const status = STATUS[report.status] ?? STATUS.pending;

  const allUris = [
    ...(report.photo_uris ?? []),
    ...(report.photo_uri ? [report.photo_uri] : []),
  ];

  const openPhotos = async () => {
    if (allUris.length === 0 || photoUrls.length > 0) return;
    setLoadingPhotos(true);
    try {
      const signed = await Promise.all(
        allUris.map((uri) =>
          base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 }),
        ),
      );
      setPhotoUrls(signed.map((s) => s.signed_url));
    } finally {
      setLoadingPhotos(false);
    }
  };

  return (
    <article className="rounded-xl border border-border bg-surface-1/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={"chip " + status.className}>{status.label}</span>
        <SeverityBadge level={report.severity} />
        <span className="chip">{hazardLabel(report.hazard_type, lang)}</span>
        {report.rating > 0 && <Stars value={report.rating} />}
      </div>

      <h3 className="mt-3 text-[13.5px] font-semibold">{report.title}</h3>
      {report.place_name && (
        <p className="mt-0.5 text-[12px] text-primary">{report.place_name}</p>
      )}
      {report.description && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{report.description}</p>
      )}

      <dl className="mono mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          {report.lat?.toFixed(4)}, {report.lng?.toFixed(4)}
          {report.position_accuracy_m ? ` · ±${Math.round(report.position_accuracy_m)} m` : ""}
        </div>
        <div>district: {report.district ? districtLabel(report.district, lang) : "not given"}</div>
        <div>observed: {String(report.observed_at ?? report.created_date ?? "").slice(0, 16).replace("T", " ")}</div>
        <div>submitted: {String(report.created_date ?? "").slice(0, 16).replace("T", " ")}</div>
        {report.water_depth_m != null && <div>reported depth: {report.water_depth_m} m</div>}
        {report.road_blocked && <div>road reported blocked</div>}
      </dl>

      {report.verification_note && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Reviewer note: {report.verification_note}
        </p>
      )}

      {allUris.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {photoUrls.length === 0 && (
            <Button size="sm" variant="outline" onClick={openPhotos} disabled={loadingPhotos} className="gap-2">
              {loadingPhotos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Open {allUris.length} photo{allUris.length > 1 ? "s" : ""}
            </Button>
          )}
          {photoUrls.map((url, i) => (
            <Image
              key={i}
              src={url}
              alt={`Report photo ${i + 1}`}
              className="h-32 w-32 rounded-lg sm:h-40 sm:w-40"
              fittingType="fill"
            />
          ))}
        </div>
      )}

      {isAdmin && report.status === "pending" && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
          <Button size="sm" onClick={() => onReview(report.id, "promote")} disabled={busy} className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify and publish as hazard
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReview(report.id, "verify")} disabled={busy} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Verify only
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReview(report.id, "reject")} disabled={busy} className="gap-1.5 text-risk-severe">
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      )}
    </article>
  );
}

export default function ReportList({ reports = [], isAdmin, onReview, busy }) {
  if (reports.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">
        No community reports yet. Reports appear here with their verification status — only verified ones are treated as
        hazards.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} isAdmin={isAdmin} onReview={onReview} busy={busy} />
      ))}
    </div>
  );
}