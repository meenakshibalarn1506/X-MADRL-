import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Languages, Contrast, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppMark from "@/components/AppMark";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";

export default function SiteHeader() {
  const { t, lang, setLang } = useLanguage();
  const { user, isAuthenticated, isLoadingAuth, logout, navigateToLogin } = useAuth();
  const [hc, setHc] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <Link to="/" className="flex items-center gap-3">
          <AppMark size={28} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <a href="#status" className="rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.overview")}
          </a>
          <a href="#modules" className="rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.modules")}
          </a>
          {isAuthenticated && (
            <Link to="/dashboard" className="rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              {t("nav.commandCentre")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "ta" ? "en" : "ta")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            aria-label={t("nav.language")}
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "ta" ? "English" : "தமிழ்"}
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

          {!isLoadingAuth && isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dashboard" })} className="gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5" />
                {t("nav.commandCentre")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => logout()} className="gap-1.5 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                {t("nav.signOut")}
              </Button>
            </div>
          ) : (
            !isLoadingAuth && (
              <Button size="sm" onClick={() => navigateToLogin()} className="hidden sm:inline-flex">
                {t("nav.signIn")}
              </Button>
            )
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground md:hidden"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-5 pb-4 pt-2 md:hidden">
          <div className="flex flex-col">
            <a href="#status" onClick={() => setOpen(false)} className="py-2 text-sm text-muted-foreground">
              {t("nav.overview")}
            </a>
            <a href="#modules" onClick={() => setOpen(false)} className="py-2 text-sm text-muted-foreground">
              {t("nav.modules")}
            </a>
            <Link to="/dashboard" onClick={() => setOpen(false)} className="py-2 text-sm text-muted-foreground">
              {t("nav.commandCentre")}
            </Link>
            {isAuthenticated ? (
              <Button variant="outline" className="mt-3" onClick={() => logout()}>
                {t("nav.signOut")} {user?.full_name ? "· " + user.full_name : ""}
              </Button>
            ) : (
              <Button className="mt-3" onClick={() => navigateToLogin()}>
                {t("nav.signIn")}
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}