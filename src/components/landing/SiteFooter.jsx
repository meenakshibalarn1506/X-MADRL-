import AppMark from "@/components/AppMark";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-lg">
            <AppMark size={26} />
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              X-MADRL is a disaster-navigation and decision-support platform for Tamil Nadu. It is not
              a substitute for official instructions: during a real emergency, follow the district
              administration, Tamil Nadu State Disaster Management Authority and police guidance
              first.
            </p>
          </div>
          <div className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            <p className="label-xs">Known limits</p>
            <ul className="mt-3 space-y-1.5">
              <li>· Google Maps Platform is not configured, so Google basemap, traffic and Routes API paths are off.</li>
              <li>· No official warning feed is connected; official alerts will appear only once one is.</li>
              <li>· The corridor network and hazard records shipped here are demonstration data.</li>
              <li>· A browser cannot guarantee navigation without GPS, network or cached maps.</li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-border pt-5 font-mono text-[11px] text-muted-foreground">
          Basemap tiles © OpenStreetMap contributors · X-MADRL demonstration build
        </p>
      </div>
    </footer>
  );
}