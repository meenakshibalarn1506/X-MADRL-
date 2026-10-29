import { useEffect, useState } from "react";
import { Bell, BellRing, Mail, MessageSquare, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TN_DISTRICTS, HAZARD_TYPES } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

const CHANNELS = [
  { key: "in_app", label: "In-app notifications", Icon: Bell, available: true },
  { key: "browser_push", label: "Browser notifications", Icon: BellRing, available: true },
  { key: "sms", label: "SMS", Icon: MessageSquare, available: false },
];

export default function AlertSubscriptionForm({ subscription, onSave, busy, onTestNotification }) {
  const { lang } = useLanguage();
  const [districts, setDistricts] = useState([]);
  const [hazardTypes, setHazardTypes] = useState([]);
  const [channels, setChannels] = useState(["in_app"]);
  const [minSeverity, setMinSeverity] = useState("caution");
  const [smsNumber, setSmsNumber] = useState("");
  const [permission, setPermission] = useState("unknown");

  useEffect(() => {
    if (!subscription) return;
    setDistricts(subscription.districts ?? []);
    setHazardTypes(subscription.hazard_types ?? []);
    setChannels(subscription.channels ?? ["in_app"]);
    setMinSeverity(subscription.min_severity ?? "caution");
    setSmsNumber(subscription.sms_number ?? "");
  }, [subscription]);

  useEffect(() => {
    if (typeof Notification === "undefined") setPermission("unsupported");
    else setPermission(Notification.permission);
  }, []);

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const requestPush = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted" && !channels.includes("browser_push")) setChannels([...channels, "browser_push"]);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Districts you want alerts for</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TN_DISTRICTS.map((d) => {
            const on = districts.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(districts, setDistricts, d.id)}
                aria-pressed={on}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                  (on ? "border-primary/60 bg-primary/12 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {lang === "ta" ? d.nameTa : d.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label-xs">Hazard classes</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HAZARD_TYPES.map((h) => {
            const on = hazardTypes.includes(h.key);
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => toggle(hazardTypes, setHazardTypes, h.key)}
                aria-pressed={on}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors " +
                  (on ? "border-primary/60 bg-primary/12 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {lang === "ta" ? h.ta : h.en}
              </button>
            );
          })}
        </div>
        {hazardTypes.length === 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">No class selected means every hazard class.</p>
        )}
      </div>

      <div>
        <p className="label-xs">Delivery channels</p>
        <ul className="mt-2 space-y-2">
          {CHANNELS.map((c) => {
            const on = channels.includes(c.key);
            return (
              <li key={c.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1/60 px-3 py-2.5">
                <span className="flex items-center gap-2 text-[12.5px]">
                  <c.Icon className="h-4 w-4 text-primary" />
                  {c.label}
                  {!c.available && (
                    <span className="chip border-risk-caution/40 bg-risk-caution/10 text-risk-caution">not configured</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={!c.available}
                  onClick={() => toggle(channels, setChannels, c.key)}
                  aria-pressed={on}
                  className={
                    "h-6 w-11 shrink-0 rounded-full border transition-colors " +
                    (!c.available
                      ? "cursor-not-allowed border-border bg-surface-3 opacity-50"
                      : on
                        ? "border-primary/60 bg-primary/25"
                        : "border-border bg-surface-3")
                  }
                >
                  <span
                    className={
                      "block h-4 w-4 rounded-full bg-foreground transition-transform " +
                      (on ? "translate-x-6" : "translate-x-1")
                    }
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {channels.includes("browser_push") && permission !== "granted" && (
          <div className="mt-3 rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-[12px] leading-relaxed">
              Browser permission is <span className="mono">{permission}</span>. Notifications will only be delivered
              once permission is granted.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={requestPush}>
                Request browser permission
              </Button>
              <Button size="sm" variant="ghost" onClick={onTestNotification} className="gap-1.5">
                <BellRing className="h-3.5 w-3.5" />
                Send a test notification
              </Button>
            </div>
          </div>
        )}

        {channels.includes("sms") && (
          <div className="mt-3">
            <label className="label-xs" htmlFor="sms-number">
              Mobile number for SMS
            </label>
            <input
              id="sms-number"
              value={smsNumber}
              onChange={(e) => setSmsNumber(e.target.value)}
              placeholder="+91…"
              className="mono mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-risk-caution">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No SMS provider is connected. The number is stored as a preference only and no message will be sent until
              a provider is configured and the number is verified. Note that a mobile number never reveals a physical
              location.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="label-xs" htmlFor="min-severity">
          Minimum severity to notify
        </label>
        <select
          id="min-severity"
          value={minSeverity}
          onChange={(e) => setMinSeverity(e.target.value)}
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
        >
          <option value="low">Low and above</option>
          <option value="caution">Caution and above</option>
          <option value="elevated">Elevated and above</option>
          <option value="severe">Severe only</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() =>
            onSave({
              districts,
              hazard_types: hazardTypes,
              channels,
              min_severity: minSeverity,
              sms_number: smsNumber || undefined,
            })
          }
          disabled={busy}
          className="gap-2 font-semibold"
        >
          <ShieldCheck className="h-4 w-4" />
          {busy ? "Saving" : "Save alert preferences"}
        </Button>
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          Preferences are stored against your account only.
        </span>
      </div>
    </div>
  );
}