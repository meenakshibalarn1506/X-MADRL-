import { useNavigate } from "@tanstack/react-router";
import { Map as MapIcon, Route as RouteIcon, BrainCircuit, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n";
import TNPreview from "@/components/landing/TNPreview";

const POINTS = [
  { icon: MapIcon, title: "One hazard picture", body: "Floods, closures, storms and landslides on a single statewide map, each layer stamped with its source and age." },
  { icon: RouteIcon, title: "Routes that know the situation", body: "Alternative routes ranked against your travel mode, hazards, closures and mobility needs — not just the shortest road." },
  { icon: BrainCircuit, title: "Decisions you can audit", body: "Every recommendation shows the factors that produced it, and you can change a priority to see what the ranking becomes." },
];

export default function Hero() {
  const { t } = useLanguage();
  const { navigateToLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const enter = () => {
    if (isAuthenticated) navigate({ to: "/dashboard" });
    else navigateToLogin();
  };

  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="animate-fade-up">
          <span className="chip text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("common.demonstration")} build · data classes labelled
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-[56px]">
            Navigate the hazard,
            <span className="block text-primary">not just the road.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("app.tagline")}. X-MADRL recommends the most suitable available route for your
            situation — the active disaster, known road hazards, travel mode, mobility needs and how
            much the underlying data can actually be trusted.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={enter} className="gap-2 font-semibold">
              {isAuthenticated ? t("nav.commandCentre") : t("nav.signIn")} to continue
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#modules">{t("nav.modules")}</a>
            </Button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              { k: "38", v: "districts" },
              { k: "12", v: "hazard classes" },
              { k: "4", v: "data classes" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-2xl text-foreground">{s.k}</dt>
                <dd className="label-xs mt-1">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-fade-up lg:pl-4">
          <TNPreview />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="grid gap-4 border-t border-border pt-8 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-surface-1/60 p-5">
              <p.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}