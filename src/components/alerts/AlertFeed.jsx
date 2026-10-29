import { Bell, ExternalLink, TriangleAlert, Info, ShieldAlert } from "lucide-react";
import { DataClassBadge, SeverityBadge } from "@/components/cc/Badges";
import { districtLabel } from "@/lib/tn";
import { hazardLabel } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

function fmt(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 16).replace("T", " ");
}

/**
 * Alert feed. Nothing is shown as an official warning unless a real official
 * feed supplied it, and nothing is claimed as delivered unless delivery was
 * actually confirmed.
 */
export default function AlertFeed({ alerts = [], history = [], district = "all" }) {
  const { t, lang } = useLanguage();
  const official = alerts.filter((a) => a.is_official);

  return (
    <div className="space-y-5">
      {official.length === 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-risk-caution/40 bg-risk-caution/10 px-3 py-2.5 text-[12px] leading-relaxed text-risk-caution">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          No official warning feed is connected, so this app is not showing any official alert. Official alerts appear
          here only after an authorised meteorological or disaster-management source is connected. For evacuation
          orders, follow the district administration and the Tamil Nadu State Disaster Management Authority.
        </p>
      )}

      <div className="space-y-3">
        <p className="label-xs">{t("mod.alerts.title")} · {alerts.length} entries</p>
        {alerts.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12.5px] text-muted-foreground">
            No alert records. Alerts are created by connected official feeds or by an administrator.
          </p>
        )}
        {alerts.map((a) => (
          <article key={a.id} className="rounded-xl border border-border bg-surface-1/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={a.severity} />
              <DataClassBadge value={a.data_class} />
              {a.is_official && <span className="chip border-primary/40 bg-primary/10 text-primary">official source</span>}
              {a.is_evacuation_order && (
                <span className="chip border-risk-severe/40 bg-risk-severe/10 text-risk-severe">evacuation order</span>
              )}
              {a.is_demonstration && (
                <span className="chip border-risk-elevated/40 bg-risk-elevated/10 text-risk-elevated">
                  demonstration — not a live warning
                </span>
              )}
            </div>

            <h3 className="mt-3 text-[14px] font-semibold">{a.title}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{a.body}</p>

            <dl className="mono mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <div>hazard: {hazardLabel(a.hazard_type, lang)}</div>
              <div>
                districts: {(a.districts ?? []).length ? a.districts.map((d) => districtLabel(d, lang)).join(", ") : "statewide"}
              </div>
              <div>issued: {fmt(a.issued_at ?? a.created_date)}</div>
              <div>expires: {fmt(a.expires_at)}</div>
              <div>source: {a.source ?? a.source_agency ?? "—"}</div>
              <div>verification: {a.verification_status?.replace(/_/g, " ") ?? "—"}</div>
            </dl>

            {a.action_required && (
              <p className="mt-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[12px] leading-relaxed">
                <span className="label-xs">Recommended action</span>
                <span className="mt-1 block">{a.action_required}</span>
              </p>
            )}

            {a.official_url && (
              <a
                href={a.official_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Official warning
              </a>
            )}
          </article>
        ))}
      </div>

      <div>
        <p className="label-xs flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          Notification history
        </p>
        {history.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-[12px] text-muted-foreground">
            Nothing has been delivered yet. An entry appears here only after a channel actually confirmed delivery.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((h, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface-1/60 px-3 py-2.5 text-[12px]">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{h.title}</span>
                  <span className="chip">{h.channel}</span>
                  {h.delivered ? (
                    <span className="chip border-risk-low/40 bg-risk-low/10 text-risk-low">delivered</span>
                  ) : (
                    <span className="chip border-risk-caution/40 bg-risk-caution/10 text-risk-caution">
                      not delivered — {h.reason}
                    </span>
                  )}
                </p>
                <p className="mono mt-1 text-[11px] text-muted-foreground">{fmt(h.at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        SMS delivery is not configured, and browser notifications only work while the site is open in this browser and
        the permission has been granted. No alert can be promised before a disaster occurs unless an authorised
        forecasting source issued it.
      </p>

      {district !== "all" && (
        <p className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" />
          Filtered to {districtLabel(district, lang)}.
        </p>
      )}
    </div>
  );
}