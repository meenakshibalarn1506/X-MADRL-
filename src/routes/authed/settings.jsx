import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings, Contrast, Languages, ShieldCheck, Trash2, LogOut, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import DistrictSelect from "@/components/controls/DistrictSelect";
import { getAlertSubscription } from "@/lib/server-fns";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n";
import { loadPreferences, savePreferences, clearPreferences, clearOfflineSnapshot } from "@/lib/journeyStore";

export const Route = createFileRoute("/_authed/settings")({
  head: () => ({
    meta: [
      { title: "Settings and Profile — X-MADRL" },
      { name: "description", content: "Language, contrast, districts, privacy controls and what this app stores." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const subFn = useServerFn(getAlertSubscription);

  const [prefs, setPrefs] = useState({
    high_contrast: false,
    home_district: "all",
    share_location_for_reports: false,
    keep_location_history: false,
  });
  const [note, setNote] = useState(null);

  useEffect(() => {
    setPrefs((p) => ({ ...p, ...loadPreferences() }));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("hc", prefs.high_contrast);
  }, [prefs.high_contrast]);

  const subscription = useQuery({ queryKey: ["subscription"], queryFn: () => subFn({}) });

  const update = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePreferences(next);
    setNote("Preference saved on this device.");
  };

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-2">
      <div className="space-y-3">
        <Panel title="Your profile" icon={ShieldCheck} defaultOpen>
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user?.full_name ?? "not set"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mono">{user?.email ?? "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                {user?.role ?? "user"}
                {user?.role === "admin" ? " — can review reports and manage records" : " — can plan routes and submit reports"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="mono">{String(user?.created_date ?? "").slice(0, 10) || "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Only your account details are held on the server. Adherence to your organisation’s data policy is your
            administrator’s responsibility.
          </p>
          <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => logout()}>
            <LogOut className="h-3.5 w-3.5" />
            {t("nav.signOut")}
          </Button>
        </Panel>

        <Panel title="Interface" icon={Languages} defaultOpen>
          <div className="space-y-4">
            <div>
              <p className="label-xs">{t("nav.language")}</p>
              <div className="mt-2 flex gap-2">
                {[
                  { key: "en", label: "English" },
                  { key: "ta", label: "தமிழ்" },
                ].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setLang(o.key)}
                    aria-pressed={lang === o.key}
                    className={
                      "rounded-full border px-3 py-1.5 text-[12px] transition-colors " +
                      (lang === o.key
                        ? "border-primary/60 bg-primary/12 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Module names, map controls, the legend and the planner labels are translated. Longer explanatory prose
                inside the analysis panels is still English while translation is extended.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1/60 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px]">
                <Contrast className="h-4 w-4 text-primary" />
                {t("nav.contrast")}
              </span>
              <button
                type="button"
                onClick={() => update({ high_contrast: !prefs.high_contrast })}
                aria-pressed={prefs.high_contrast}
                className={
                  "h-6 w-11 shrink-0 rounded-full border transition-colors " +
                  (prefs.high_contrast ? "border-primary/60 bg-primary/25" : "border-border bg-surface-3")
                }
              >
                <span
                  className={
                    "block h-4 w-4 rounded-full bg-foreground transition-transform " +
                    (prefs.high_contrast ? "translate-x-6" : "translate-x-1")
                  }
                />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              High-contrast mode strengthens text, borders and surface separation. Risk is always shown with a label and
              an icon as well as colour, so the palette is never the only signal.
            </p>
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel title="Districts and alerts" icon={MapPin} defaultOpen>
          <div>
            <label className="label-xs" htmlFor="home-district">
              Default district
            </label>
            <div className="mt-1.5">
              <DistrictSelect id="home-district" value={prefs.home_district} onChange={(v) => update({ home_district: v })} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Used as the starting filter in the map and planner.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface-1/60 p-3">
            <p className="label-xs">Alert subscription</p>
            {subscription.isLoading ? (
              <p className="mt-1.5 text-[12px] text-muted-foreground">Loading…</p>
            ) : subscription.data?.subscription ? (
              <ul className="mt-1.5 space-y-1 text-[12px] text-muted-foreground">
                <li>· districts: {(subscription.data.subscription.districts ?? []).length || "all"}</li>
                <li>· channels: {(subscription.data.subscription.channels ?? []).join(", ") || "none"}</li>
                <li>
                  · verified channels: {(subscription.data.subscription.verified_channels ?? []).join(", ") || "none"}
                </li>
                <li>· minimum severity: {subscription.data.subscription.min_severity}</li>
              </ul>
            ) : (
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                No subscription yet. Set one in the Early Warnings module.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Privacy and what is stored" icon={ShieldCheck} defaultOpen>
          <ul className="space-y-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <li>· Location history is not kept. Live position fixes are used in memory and are not written to the database.</li>
            <li>· A route plan is stored only when you press “Save this plan”, and you can delete it from the planner.</li>
            <li>· Community reports are stored with the point you supply and your account id, and are visible to signed-in users of this app for review.</li>
            <li>· An attached report photo is stored privately and opened through a short-lived signed link.</li>
            <li>· Language, contrast, default district and the offline snapshot are kept in this browser only.</li>
            <li>· A mobile number entered for SMS stays a preference and is never used to infer your physical location.</li>
          </ul>

          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1/60 px-3 py-2.5">
              <span className="text-[12.5px]">Keep location history (off by default)</span>
              <button
                type="button"
                onClick={() => update({ keep_location_history: !prefs.keep_location_history })}
                aria-pressed={prefs.keep_location_history}
                className={
                  "h-6 w-11 shrink-0 rounded-full border transition-colors " +
                  (prefs.keep_location_history ? "border-primary/60 bg-primary/25" : "border-border bg-surface-3")
                }
              >
                <span
                  className={
                    "block h-4 w-4 rounded-full bg-foreground transition-transform " +
                    (prefs.keep_location_history ? "translate-x-6" : "translate-x-1")
                  }
                />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              This build has no location-history store at all, so switching this on changes nothing except the recorded
              preference. It exists so the intent is explicit.
            </p>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1/60 px-3 py-2.5">
              <span className="text-[12.5px]">Attach my position to community reports automatically</span>
              <button
                type="button"
                onClick={() => update({ share_location_for_reports: !prefs.share_location_for_reports })}
                aria-pressed={prefs.share_location_for_reports}
                className={
                  "h-6 w-11 shrink-0 rounded-full border transition-colors " +
                  (prefs.share_location_for_reports ? "border-primary/60 bg-primary/25" : "border-border bg-surface-3")
                }
              >
                <span
                  className={
                    "block h-4 w-4 rounded-full bg-foreground transition-transform " +
                    (prefs.share_location_for_reports ? "translate-x-6" : "translate-x-1")
                  }
                />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                clearPreferences();
                clearOfflineSnapshot();
                setPrefs({ high_contrast: false, home_district: "all", share_location_for_reports: false, keep_location_history: false });
                document.documentElement.classList.remove("hc");
                setNote("Local preferences and the offline snapshot were deleted from this browser.");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete data stored in this browser
            </Button>
          </div>
          {note && <p className="mt-3 text-[11.5px] text-muted-foreground">{note}</p>}
        </Panel>

        <Panel title="Accessibility" icon={Settings} defaultOpen={false}>
          <ul className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
            <li>· Every control is a real button or input with a visible label or an accessible name.</li>
            <li>· Touch targets are sized for use on a phone in poor conditions.</li>
            <li>· Risk is communicated with text and icons alongside colour, and the legend states what each layer means.</li>
            <li>· Animations are suppressed automatically when your device requests reduced motion.</li>
          </ul>
        </Panel>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This app is decision support, not an emergency service. During a real emergency, follow the district
          administration, the Tamil Nadu State Disaster Management Authority and the police.
        </p>
      </div>
    </div>
  );
}