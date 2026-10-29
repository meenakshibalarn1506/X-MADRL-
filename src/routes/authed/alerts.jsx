import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import Panel from "@/components/cc/Panel";
import DistrictSelect from "@/components/controls/DistrictSelect";
import AlertFeed from "@/components/alerts/AlertFeed";
import AlertSubscriptionForm from "@/components/alerts/AlertSubscriptionForm";
import { listAlertFeed, getAlertSubscription, saveAlertSubscription } from "@/lib/server-fns";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/alerts")({
  head: () => ({
    meta: [
      { title: "Early Warnings — X-MADRL" },
      { name: "description", content: "Official alert feed, district subscriptions and notification history." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const feedFn = useServerFn(listAlertFeed);
  const subFn = useServerFn(getAlertSubscription);
  const saveFn = useServerFn(saveAlertSubscription);

  const [district, setDistrict] = useState("all");
  const [history, setHistory] = useState([]);
  const [saveNote, setSaveNote] = useState(null);

  const feed = useQuery({
    queryKey: ["alerts", district],
    queryFn: () => feedFn({ data: { district } }),
  });

  const subscription = useQuery({
    queryKey: ["subscription"],
    queryFn: () => subFn({}),
  });

  const save = useMutation({
    mutationFn: (payload) => saveFn({ data: payload }),
    onSuccess: () => {
      setSaveNote("Alert preferences saved. Only channels that can actually deliver are activated.");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => setSaveNote("Preferences could not be saved: " + (err?.message ?? "unknown error")),
  });

  useEffect(() => {
    if (!saveNote) return undefined;
    const id = setTimeout(() => setSaveNote(null), 6000);
    return () => clearTimeout(id);
  }, [saveNote]);

  const sendTest = () => {
    const entry = {
      title: "X-MADRL test notification",
      channel: "browser_push",
      at: new Date().toISOString(),
      delivered: false,
      reason: "permission not granted",
    };
    if (typeof Notification === "undefined") {
      entry.reason = "this browser has no Notification API";
      setHistory((h) => [entry, ...h]);
      return;
    }
    if (Notification.permission !== "granted") {
      entry.reason = `permission is ${Notification.permission}`;
      setHistory((h) => [entry, ...h]);
      return;
    }
    try {
      const n = new Notification("X-MADRL test notification", {
        body: "This confirms the browser can display an alert. No hazard is being reported.",
      });
      entry.delivered = true;
      entry.reason = null;
      n.onclose = () => undefined;
    } catch (err) {
      entry.reason = err?.message ?? "the browser refused the notification";
    }
    setHistory((h) => [entry, ...h]);
  };

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t("mod.alerts.title")}</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Official warnings are the authoritative source for evacuation orders. Nothing here is labelled official
              unless an official feed supplied it.
            </p>
          </div>
          <div className="w-[220px]">
            <DistrictSelect value={district} onChange={setDistrict} includeAll />
          </div>
        </div>

        <Panel title="Alert feed" icon={Bell} defaultOpen>
          {feed.isLoading ? (
            <p className="text-[12.5px] text-muted-foreground">Loading alerts…</p>
          ) : feed.isError ? (
            <p className="text-[12.5px] text-risk-severe">
              The feed could not be loaded: {String(feed.error?.message ?? "").slice(0, 140)}
            </p>
          ) : (
            <AlertFeed alerts={feed.data?.alerts ?? []} history={history} district={district} />
          )}
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel title="My alert preferences" icon={BellRing} defaultOpen>
          {subscription.isLoading ? (
            <p className="text-[12.5px] text-muted-foreground">Loading your preferences…</p>
          ) : (
            <AlertSubscriptionForm
              subscription={subscription.data?.subscription ?? null}
              onSave={(payload) => save.mutate(payload)}
              busy={save.isPending}
              onTestNotification={sendTest}
            />
          )}
        </Panel>

        {saveNote && (
          <p className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            {saveNote}
          </p>
        )}

        <Panel title="Delivery channels and their real state" defaultOpen={false}>
          <ul className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
            <li>· In-app: works. Alerts appear in this module and on the map dashboard.</li>
            <li>
              · Browser notifications: work only while this site is open in the browser and permission is granted
              (currently{" "}
              {typeof Notification === "undefined" ? "unsupported in this browser" : Notification.permission}).
            </li>
            <li>· SMS: no provider is connected, so no SMS can be sent from this build. Any number entered is stored as a preference only.</li>
          </ul>
          <Button size="sm" variant="outline" className="mt-3" onClick={sendTest}>
            Record a test notification attempt
          </Button>
        </Panel>
      </div>
    </div>
  );
}