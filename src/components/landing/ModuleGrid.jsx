import { Link } from "@tanstack/react-router";
import {
  Map as MapIcon,
  Route as RouteIcon,
  Compass,
  BrainCircuit,
  Bell,
  Users,
  Shield,
  TrendingUp,
  Settings,
  Database,
  FlaskConical,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const MODULES = [
  { icon: MapIcon, key: "mod.map", to: "/dashboard" },
  { icon: RouteIcon, key: "mod.planner", to: "/planner" },
  { icon: BrainCircuit, key: "mod.explain", to: "/explain" },
  { icon: Compass, key: "mod.gps", to: "/gps" },
  { icon: Bell, key: "mod.alerts", to: "/alerts" },
  { icon: Users, key: "mod.reports", to: "/reports" },
  { icon: Shield, key: "mod.shelters", to: "/shelters" },
  { icon: TrendingUp, key: "mod.analytics", to: "/analytics" },
  { icon: Settings, key: "mod.settings", to: "/settings" },
  { icon: Database, key: "mod.sources", to: "/sources" },
  { icon: FlaskConical, key: "mod.simulation", to: "/simulation" },
];

export default function ModuleGrid() {
  const { t } = useLanguage();
  return (
    <section id="modules" className="mx-auto max-w-6xl px-5 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("nav.modules")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Eleven working modules. Sign in to open any of them — nothing here is a decorative
            button.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group rounded-xl border border-border bg-surface-1/60 p-5 transition-colors hover:border-primary/60 hover:bg-surface-2/70"
          >
            <div className="flex items-start justify-between gap-3">
              <m.icon className="h-5 w-5 text-primary" />
              <span className="font-mono text-[10px] text-muted-foreground transition-colors group-hover:text-primary">
                open →
              </span>
            </div>
            <h3 className="mt-4 text-sm font-semibold">{t(m.key + ".title")}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t(m.key + ".sub")}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}