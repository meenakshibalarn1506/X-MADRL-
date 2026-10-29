import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
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
  Menu,
  X,
  Contrast,
  Languages,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AppMark from "@/components/AppMark";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { to: "/dashboard", icon: MapIcon, key: "mod.map" },
  { to: "/planner", icon: RouteIcon, key: "mod.planner" },
  { to: "/explain", icon: BrainCircuit, key: "mod.explain" },
  { to: "/gps", icon: Compass, key: "mod.gps" },
  { to: "/alerts", icon: Bell, key: "mod.alerts" },
  { to: "/reports", icon: Users, key: "mod.reports" },
  { to: "/shelters", icon: Shield, key: "mod.shelters" },
  { to: "/analytics", icon: TrendingUp, key: "mod.analytics" },
  { to: "/sources", icon: Database, key: "mod.sources" },
  { to: "/simulation", icon: FlaskConical, key: "mod.simulation" },
  { to: "/settings", icon: Settings, key: "mod.settings" },
];

export default function CommandShell({ children }) {
  const { t, lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hc, setHc] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem("xmadrl.hc") === "1";
    } catch {
      saved = false;
    }
    setHc(saved);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("hc", hc);
  }, [hc]);

  const toggleHc = () => {
    const next = !hc;
    setHc(next);
    try {
      window.localStorage.setItem("xmadrl.hc", next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };

  const active = NAV.find((n) => pathname === n.to) ?? NAV[0];

  const NavList = ({ compact }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const isActive = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            title={t(item.key + ".title")}
            aria-current={isActive ? "page" : undefined}
            className={
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors " +
              (isActive
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!compact ? <span className="truncate">{t(item.key + ".title")}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="topo-lines flex min-h-screen">
      {/* Desktop rail */}
      <aside
        className={
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface-1/60 lg:flex " +
          (collapsed ? "w-[68px]" : "w-[248px]")
        }
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Link to="/" className="min-w-0">
            <AppMark size={26} withWordmark={!collapsed} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-2.5">
          <NavList compact={collapsed} />
        </div>
        <div className="border-t border-border p-2.5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? <span>Collapse rail</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[280px] border-r border-border bg-surface-1 p-3">
            <div className="flex items-center justify-between px-1 py-1.5">
              <AppMark size={24} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground"
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <NavList compact={false} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground lg:hidden"
              aria-label={t("nav.openMenu")}
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="label-xs">{t(active.key + ".title")}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">{t(active.key + ".sub")}</p>
            </div>

            <button
              type="button"
              onClick={() => setLang(lang === "ta" ? "en" : "ta")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("nav.language")}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "ta" ? "EN" : "தமிழ்"}
            </button>

            <button
              type="button"
              onClick={toggleHc}
              aria-pressed={hc}
              className={
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors " +
                (hc ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              <Contrast className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("nav.contrast")}</span>
            </button>

            <Button
              size="sm"
              variant="ghost"
              className="hidden gap-2 text-muted-foreground sm:inline-flex"
              onClick={() => logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
              {user?.full_name ? user.full_name.split(" ")[0] : t("nav.signOut")}
            </Button>
            <Button size="sm" variant="outline" className="sm:hidden" onClick={() => logout()}>
              {t("nav.signOut")}
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}