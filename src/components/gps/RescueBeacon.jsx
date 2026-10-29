import { useState } from "react";
import { Phone, Send, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { createRescueBeacon, revokeRescueBeacon, listRescueBeacons } from "@/lib/server-fns";

const SOURCE_LABEL = {
  gps_confirmed: "GPS-confirmed",
  manual: "Manually selected",
  last_known: "Last known",
};

/**
 * Consent-based rescue beacon. The user explicitly chooses a position source,
 * enters an optional message and contact, and submits. The beacon is stored
 * privately (only the creator can see it). Nothing is broadcast to emergency
 * services — the 112 link dials the number, it does not transmit coordinates.
 */
export default function RescueBeacon({ position, lastReliable, positionSourceLabel }) {
  const createFn = useServerFn(createRescueBeacon);
  const revokeFn = useServerFn(revokeRescueBeacon);
  const listFn = useServerFn(listRescueBeacons);
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sourceChoice, setSourceChoice] = useState("manual");

  const { data, isLoading } = useQuery({
    queryKey: ["rescue-beacons"],
    queryFn: () => listFn({}),
  });

  const activeBeacon = (data?.beacons ?? []).find((b) => b.status === "active");

  const createMut = useMutation({
    mutationFn: (payload) => createFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rescue-beacons"] }),
  });

  const revokeMut = useMutation({
    mutationFn: (id) => revokeFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rescue-beacons"] }),
  });

  const chosenPosition = sourceChoice === "gps_confirmed" ? position : sourceChoice === "last_known" ? lastReliable : null;

  const canSubmit =
    chosenPosition != null &&
    chosenPosition.lat != null &&
    chosenPosition.lng != null &&
    !createMut.isPending;

  const submit = () => {
    if (!chosenPosition) return;
    createMut.mutate({
      position_source: sourceChoice,
      lat: chosenPosition.lat,
      lng: chosenPosition.lng,
      accuracy_m: chosenPosition.accuracy ?? null,
      fix_timestamp: chosenPosition.at ?? new Date().toISOString(),
      message: message.trim() || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-risk-elevated/40 bg-risk-elevated/10 px-3 py-2.5 text-[12px] leading-relaxed text-risk-elevated">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This beacon saves your position privately so you have a reference to share. It does <strong>not</strong>{" "}
          automatically contact emergency services or transmit your location to rescuers.
        </span>
      </div>

      {activeBeacon ? (
        <div className="space-y-3 rounded-lg border border-risk-low/40 bg-risk-low/10 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-risk-low" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-risk-low">Beacon active</p>
              <p className="mono mt-1 text-[12px] text-foreground">
                Reference ID: <span className="font-semibold">{activeBeacon.rescue_id}</span>
              </p>
              <p className="mono mt-1 text-[11px] text-muted-foreground">
                {activeBeacon.lat.toFixed(4)}, {activeBeacon.lng.toFixed(4)} · {SOURCE_LABEL[activeBeacon.position_source]}
              </p>
              {activeBeacon.message && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">“{activeBeacon.message}”</p>
              )}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Expires {String(activeBeacon.expires_at).slice(0, 16).replace("T", " ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => revokeMut.mutate(activeBeacon.id)}
              disabled={revokeMut.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Stop sharing / revoke
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="label-xs">Position source</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { key: "manual", label: "Manual point", hint: "use a map-clicked position" },
                { key: "gps_confirmed", label: "GPS-confirmed", hint: "use the live fix" },
                { key: "last_known", label: "Last known", hint: "use the last reliable fix" },
              ].map((opt) => {
              const disabled =
                (opt.key === "gps_confirmed" && (!position || position.ageSeconds > 30)) ||
                (opt.key === "last_known" && !lastReliable);
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSourceChoice(opt.key)}
                  aria-pressed={sourceChoice === opt.key}
                  className={
                    "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                    (sourceChoice === opt.key
                      ? "border-primary/60 bg-primary/12 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
                  {opt.label}
                </button>
              );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {sourceChoice === "manual"
                ? "Select a point on the map first, then share it."
                : sourceChoice === "gps_confirmed"
                  ? position && position.ageSeconds <= 30
                    ? `Using live fix: ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
                    : "No fresh GPS fix available. Acquire position first."
                  : lastReliable
                    ? `Using last known: ${lastReliable.lat.toFixed(4)}, ${lastReliable.lng.toFixed(4)}`
                    : "No reliable previous fix available."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Contact name (optional)"
              value={contactName}
              maxLength={160}
              onChange={(e) => setContactName(e.target.value)}
              className="h-9 rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
            />
            <input
              type="tel"
              placeholder="Contact phone (optional)"
              value={contactPhone}
              maxLength={40}
              onChange={(e) => setContactPhone(e.target.value)}
              className="h-9 rounded-md border border-input bg-surface-1 px-2.5 text-[13px] outline-none focus:border-primary"
            />
          </div>

          <textarea
            placeholder="Short emergency message (optional, max 500 chars)"
            value={message}
            maxLength={500}
            rows={2}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-[13px] outline-none focus:border-primary"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" onClick={submit} disabled={!canSubmit}>
              <Send className="h-3.5 w-3.5" />
              {createMut.isPending ? "Submitting…" : "Submit beacon"}
            </Button>
            <a href="tel:112">
              <Button size="sm" variant="destructive" className="gap-2">
                <Phone className="h-3.5 w-3.5" />
                Call 112 (India emergency)
              </Button>
            </a>
          </div>

          {createMut.isError && (
            <p className="rounded-lg border border-risk-severe/40 bg-risk-severe/10 px-3 py-2 text-[12px] text-risk-severe">
              Submission failed: {String(createMut.error?.message ?? "unknown error").slice(0, 160)}. Your entered details
              are retained on this form.
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The beacon is stored privately — only you and app admins can see it. Beacons expire automatically after 24
            hours. Calling 112 dials India's emergency number; it does <strong>not</strong> send your coordinates.
          </p>
        </>
      )}
    </div>
  );
}