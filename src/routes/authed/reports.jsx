import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import StatCard from "@/components/cc/StatCard";
import SmartMap from "@/components/map/SmartMap";
import DistrictSelect from "@/components/controls/DistrictSelect";
import ReportForm from "@/components/reports/ReportForm";
import ReportList from "@/components/reports/ReportList";
import { listCommunityReports, createCommunityReport, reviewCommunityReport } from "@/lib/server-fns";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/reports")({
  head: () => ({
    meta: [
      { title: "Community Reports — X-MADRL" },
      { name: "description", content: "Submit and review community hazard reports with verification status." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCommunityReports);
  const createFn = useServerFn(createCommunityReport);
  const reviewFn = useServerFn(reviewCommunityReport);

  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");
  const [position, setPosition] = useState(null);
  const [note, setNote] = useState(null);
  const [view, setView] = useState({ lat: 10.85, lng: 78.55, zoom: 7 });
  const [selectedReport, setSelectedReport] = useState(null);

  const reports = useQuery({
    queryKey: ["reports", district, status],
    queryFn: () => listFn({ data: { district, status } }),
  });

  const create = useMutation({
    mutationFn: (payload) => createFn({ data: payload }),
    onSuccess: (res) => {
      const ref = res?.report?.id?.slice(-8) ?? "";
      setNote(
        `Report submitted with status “pending”${ref ? ` (ref: …${ref})` : ""}. It becomes a hazard only after an administrator verifies it.`,
      );
      setPosition(null);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err) => setNote("The report could not be submitted: " + (err?.message ?? "unknown error")),
  });

  const review = useMutation({
    mutationFn: (payload) => reviewFn({ data: payload }),
    onSuccess: (res) => {
      setNote(
        res?.promoted_hazard
          ? "Report verified and published as a hazard record."
          : "Report status updated.",
      );
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err) => setNote("The review action failed: " + (err?.message ?? "unknown error")),
  });

  const isAdmin = user?.role === "admin";
  const items = reports.data?.reports ?? [];
  const counts = reports.data?.counts ?? { total: 0, pending: 0, verified: 0, rejected: 0 };

  const markers = items
    .filter((r) => r.lat != null)
    .map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      tone: r.status === "verified" ? "low" : r.status === "pending" ? "caution" : "unknown",
      label: r.title,
      selected: selectedReport?.id === r.id,
      pulse: r.status === "pending",
      onClick: () => setSelectedReport(r),
    }));

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[400px_1fr]">
      <div className="space-y-3">
        <Panel title="Report an incident" icon={Users} defaultOpen>
          <ReportForm
            position={position}
            onPositionChange={setPosition}
            district={district}
            onDistrictChange={setDistrict}
            onSubmit={(payload) => create.mutate(payload)}
            busy={create.isPending}
          />
        </Panel>

        <Panel title="Reports in view" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total" value={counts.total} tone="muted" />
            <StatCard label="Pending" value={counts.pending} tone="caution" />
            <StatCard label="Verified" value={counts.verified} tone="low" />
            <StatCard label="Rejected / duplicate" value={counts.rejected} tone="severe" />
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t("mod.reports.title")}</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              A report is evidence, not a confirmed hazard. Only verified reports are treated as hazards by the planner.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[190px]">
              <DistrictSelect value={district} onChange={setDistrict} />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="duplicate">Duplicate</option>
            </select>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => reports.refetch()} disabled={reports.isFetching}>
              <RefreshCw className={"h-3.5 w-3.5 " + (reports.isFetching ? "animate-spin" : "")} />
              {t("common.refresh")}
            </Button>
          </div>
        </div>

        {note && (
          <p className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            {note}
          </p>
        )}

        <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
          <div className="space-y-2">
            <SmartMap
              center={view}
              zoom={view.zoom}
              markers={markers}
              onViewChange={setView}
              onMapClick={(p) => setPosition({ lat: p.lat, lng: p.lng, label: "Pinned on map" })}
              className="h-[420px] sm:h-[480px] w-full overflow-hidden rounded-xl border border-border"
              ariaLabel="Community report locations"
            />
            <p className="text-[11.5px] text-muted-foreground">
              Clicking the map sets the position for your report. Click a marker to see the report. Amber markers are
              pending, green are verified, grey are rejected or duplicates.
            </p>
          </div>

          <div className="space-y-3">
            {selectedReport && (
              <div className="rounded-xl border border-primary/40 bg-surface-1/80 p-4 backdrop-blur">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13.5px] font-semibold">{selectedReport.title}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedReport(null)}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selectedReport.place_name && (
                  <p className="mt-0.5 text-[12px] text-primary">{selectedReport.place_name}</p>
                )}
                <p className="mono mt-1.5 text-[10.5px] text-muted-foreground">
                  {selectedReport.lat?.toFixed(4)}, {selectedReport.lng?.toFixed(4)}
                  {selectedReport.position_accuracy_m ? ` · ±${Math.round(selectedReport.position_accuracy_m)} m` : ""}
                </p>
                {selectedReport.description && (
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{selectedReport.description}</p>
                )}
                <p className="mono mt-2 text-[10.5px] text-muted-foreground">
                  Status: {selectedReport.status} · submitted {String(selectedReport.created_date ?? "").slice(0, 10)}
                </p>
                {(selectedReport.photo_uris?.length ?? (selectedReport.photo_uri ? 1 : 0)) > 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    📷 {(selectedReport.photo_uris?.length ?? 0) + (selectedReport.photo_uri ? 1 : 0)} photo(s) attached — open the full card below to view.
                  </p>
                )}
              </div>
            )}

            {reports.isLoading ? (
              <p className="text-[12.5px] text-muted-foreground">Loading reports…</p>
            ) : reports.isError ? (
              <p className="text-[12.5px] text-risk-severe">
                Reports could not be loaded: {String(reports.error?.message ?? "").slice(0, 140)}
              </p>
            ) : (
              <ReportList
                reports={items}
                isAdmin={isAdmin}
                busy={review.isPending}
                onReview={(id, action) => review.mutate({ id, action })}
              />
            )}
          </div>
        </div>

        {!isAdmin && (
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Only an administrator can verify, reject or publish a report as a hazard. You can still submit reports and see
            how they are classified.
          </p>
        )}
      </div>
    </div>
  );
}