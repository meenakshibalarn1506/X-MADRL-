import { createFileRoute } from "@tanstack/react-router";
import Hero from "@/components/landing/Hero";
import SystemStatus from "@/components/landing/SystemStatus";
import ModuleGrid from "@/components/landing/ModuleGrid";

export const Route = createFileRoute("/_site/")({
  head: () => ({
    meta: [
      { title: "X-MADRL — Explainable Multi-Hazard Disaster Navigation for Tamil Nadu" },
      {
        name: "description",
        content:
          "Risk-aware evacuation navigation across all 38 districts of Tamil Nadu: multi-hazard mapping, alternative route comparison, explainable route decisions and GPS-denied fallback guidance.",
      },
      { name: "theme-color", content: "#0a1424" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <Hero />
      <SystemStatus />
      <ModuleGrid />
    </>
  );
}