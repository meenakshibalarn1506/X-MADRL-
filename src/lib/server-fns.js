import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  activeHazards,
  lightHazard,
  lightSegment,
  loadFullNetwork,
  loadNetwork,
  num,
  pageItems,
} from "@/lib/net.server";
import { planRoutes as runPlanner, simulationNetwork, ENGINE_VERSION } from "@/lib/routing.server";
import { googleStatus, readMapsConfig } from "@/lib/google.server";
import { geocodeNominatim } from "@/lib/geocode.server";

function parse(schema, input) {
  return schema.parse(input ?? {});
}

function requireAdmin(context) {
  if (context.user?.role !== "admin") {
    throw Object.assign(new Error("Administrator role required"), { status: 403, code: "FORBIDDEN" });
  }
}

const pointSchema = z.object({
  label: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ---------------------------------------------------------------- dashboard

const dashboardInput = z
  .object({
    district: z.string().max(60).optional(),
    hazard_types: z.array(z.string().max(40)).max(12).optional(),
    data_classes: z.array(z.string().max(20)).max(5).optional(),
  })
  .optional();

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(dashboardInput, data);
    const district = input.district ?? "all";
    const base44 = context.getBase44();
    const network = await loadNetwork(base44, { district });
    const nowMs = Date.now();

    const hazards = activeHazards(network.hazards, nowMs).filter((h) => {
      if (input.hazard_types?.length && !input.hazard_types.includes(h.hazard_type)) return false;
      if (input.data_classes?.length && !input.data_classes.includes(h.data_class)) return false;
      return true;
    });

    const counts = { by_type: {}, by_severity: {}, by_class: {}, total: hazards.length };
    for (const h of hazards) {
      counts.by_type[h.hazard_type] = (counts.by_type[h.hazard_type] ?? 0) + 1;
      counts.by_severity[h.severity] = (counts.by_severity[h.severity] ?? 0) + 1;
      counts.by_class[h.data_class] = (counts.by_class[h.data_class] ?? 0) + 1;
    }

    return {
      district,
      snapshot_at: new Date(nowMs).toISOString(),
      hazards: hazards.map(lightHazard),
      shelters: network.shelters,
      alerts: network.alerts,
      sources: network.sources,
      places: network.places,
      segments: network.segments.map(lightSegment),
      counts,
      google: googleStatus(),
      network_note: network.segments.some((s) => s.is_demonstration)
        ? "The road and hazard records in this build are demonstration data, stamped as demonstration or simulated."
        : null,
    };
  });

// ------------------------------------------------------------------- search

const searchInput = z.object({
  q: z.string().min(1).max(80),
  district: z.string().max(60).optional(),
  limit: z.number().min(1).max(25).optional(),
});

export const searchPlaces = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const { q, district, limit } = parse(searchInput, data);
    const base44 = context.getBase44();
    const query = { search_terms: { $regex: q.toLowerCase() } };
    if (district && district !== "all") query.district = district;

    const res = await base44.entities.Place.filter(query, { limit: limit ?? 12 });
    let items = pageItems(res);

    if (items.length === 0) {
      const fallback = await base44.entities.Place.filter(
        district && district !== "all" ? { district } : {},
        { limit: 12 },
      );
      items = pageItems(fallback);
    }

    return { query: q, results: items };
  });

// --------------------------------------------------------------- geocoding

const geocodeInput = z.object({
  q: z.string().min(1).max(80),
  limit: z.number().min(1).max(12).optional(),
});

export const geocodePlaces = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const { q, limit } = parse(geocodeInput, data);
    const base44 = context.getBase44();

    // Try the real geocoder first.
    try {
      const geocoded = await geocodeNominatim(q, { limit: limit ?? 8 });
      if (geocoded.length > 0) {
        return { query: q, results: geocoded, source: "openstreetmap_nominatim" };
      }
    } catch {
      // Fall through to the bundled index.
    }

    // Fallback: the bundled Tamil Nadu reference index.
    const query = { search_terms: { $regex: q.toLowerCase() } };
    const res = await base44.entities.Place.filter(query, { limit: limit ?? 12 });
    let items = pageItems(res);
    if (items.length === 0) {
      const fallback = await base44.entities.Place.filter({}, { limit: 12 });
      items = pageItems(fallback);
    }
    return { query: q, results: items, source: "bundled_reference_index" };
  });

// ------------------------------------------------------------------ routing

const journeyInput = z.object({
  origin: pointSchema,
  destination: pointSchema,
  mode: z.enum(["walking", "cycling", "driving"]).default("driving"),
  preferences: z
    .object({
      pets: z.boolean().optional(),
      luggage: z.boolean().optional(),
      children: z.boolean().optional(),
      older_adults: z.boolean().optional(),
      mobility_needs: z.boolean().optional(),
      max_walk_km: z.number().min(0.2).max(40).optional(),
      destination_need: z
        .enum(["any", "shelter", "hospital", "relief_centre", "fire_station", "police_station"])
        .optional(),
      priority: z.enum(["balanced", "low_hazard", "fastest", "shortest", "accessible"]).optional(),
    })
    .optional(),
  weights: z.record(z.string(), z.number().min(0).max(10)).optional(),
  persist: z.boolean().optional(),
});

export const planJourney = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(journeyInput, data);
    const base44 = context.getBase44();
    const network = await loadFullNetwork(base44);
    const nowMs = Date.now();

    const result = await runPlanner({
      network: { ...network, hazards: activeHazards(network.hazards, nowMs) },
      request: {
        origin: input.origin,
        destination: input.destination,
        mode: input.mode,
        preferences: input.preferences,
        weights: input.weights,
      },
      nowMs,
    });

    const payload = { ...result, google: googleStatus(), engine_version: ENGINE_VERSION };

    if (input.persist && context.user) {
      const saved = await base44.entities.RoutePlan.create({
        origin: input.origin,
        destination: input.destination,
        mode: input.mode,
        preferences: { ...(input.preferences ?? {}), weights: result.weights },
        destination_need: input.preferences?.destination_need ?? "any",
        engine: result.engine,
        engine_notice: result.engine_notice,
        google_configured: payload.google.configured,
        alternatives: result.candidates.map((c) => ({
          key: c.key,
          label: c.label,
          distance_km: c.distance_km,
          travel_time_min: c.travel_time_min,
          risk_score: c.risk_score,
          suitable: c.suitable,
        })),
        recommended_index: result.candidates.findIndex((c) => c.key === result.recommended_key),
        excluded: result.excluded,
        shortest_comparison: result.baselines?.shortest
          ? {
              distance_km: result.baselines.shortest.distance_km,
              travel_time_min: result.baselines.shortest.travel_time_min,
              risk_score: result.baselines.shortest.risk_score,
            }
          : null,
        data_snapshot_at: result.data_snapshot_at,
        is_demonstration: result.network.demonstration,
      });
      payload.saved_plan_id = saved?.id ?? null;
    }

    return payload;
  });

export const listSavedPlans = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const res = await base44.entities.RoutePlan.filter({ created_by_id: context.user.id }, { limit: 25, sort: "-created_date" });
    return { plans: pageItems(res) };
  });

const idInput = z.object({ id: z.string().min(1).max(80) });

export const deleteSavedPlan = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const { id } = parse(idInput, data);
    await context.getBase44().entities.RoutePlan.delete(id);
    return { deleted: id };
  });

// ----------------------------------------------------------------- shelters

const shelterInput = z
  .object({
    district: z.string().max(60).optional(),
    facility_type: z.string().max(40).optional(),
    q: z.string().max(80).optional(),
  })
  .optional();

export const listShelterDirectory = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(shelterInput, data);
    const query = {};
    if (input.district && input.district !== "all") query.district = input.district;
    if (input.facility_type && input.facility_type !== "all") query.facility_type = input.facility_type;
    const res = await context.getBase44().entities.Shelter.filter(query, { limit: 300 });
    let items = pageItems(res);
    if (input.q) {
      const needle = input.q.trim().toLowerCase();
      items = items.filter(
        (s) =>
          String(s.name ?? "").toLowerCase().includes(needle) ||
          String(s.address ?? "").toLowerCase().includes(needle) ||
          String(s.district ?? "").toLowerCase().includes(needle),
      );
    }
    return { facilities: items, count: items.length };
  });

// ------------------------------------------------------------ hazard + feed

const hazardInput = z
  .object({
    district: z.string().max(60).optional(),
    hazard_types: z.array(z.string().max(40)).max(12).optional(),
    severity: z.string().max(20).optional(),
    limit: z.number().min(1).max(300).optional(),
  })
  .optional();

export const listHazardsFeed = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(hazardInput, data);
    const query = {};
    if (input.district && input.district !== "all") query.district = input.district;
    if (input.hazard_types?.length === 1) query.hazard_type = input.hazard_types[0];
    if (input.severity) query.severity = input.severity;

    const res = await context.getBase44().entities.Hazard.filter(query, {
      limit: input.limit ?? 200,
      sort: "-last_update",
    });
    let items = activeHazards(pageItems(res));
    if (input.hazard_types?.length > 1) {
      items = items.filter((h) => input.hazard_types.includes(h.hazard_type));
    }
    return { hazards: items.map(lightHazard), count: items.length };
  });

// --------------------------------------------------------- community reports

const reportInput = z
  .object({
    district: z.string().max(60).optional(),
    status: z.string().max(20).optional(),
  })
  .optional();

export const listCommunityReports = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(reportInput, data);
    const query = {};
    if (input.district && input.district !== "all") query.district = input.district;
    if (input.status && input.status !== "all") query.status = input.status;
    const res = await context.getBase44().entities.CommunityReport.filter(query, {
      limit: 200,
      sort: "-created_date",
    });
    const items = pageItems(res);
    return {
      reports: items,
      counts: {
        total: items.length,
        pending: items.filter((r) => r.status === "pending").length,
        verified: items.filter((r) => r.status === "verified").length,
        rejected: items.filter((r) => r.status === "rejected" || r.status === "duplicate").length,
      },
    };
  });

const createReportInput = z.object({
  title: z.string().min(3).max(140),
  hazard_type: z.enum([
    "flood",
    "stagnation",
    "damaged_road",
    "closure",
    "cyclone",
    "tsunami",
    "earthquake",
    "landslide",
    "fire",
    "industrial",
    "debris",
    "other",
  ]),
  severity: z.enum(["low", "caution", "elevated", "severe"]).default("caution"),
  description: z.string().max(1200).optional(),
  district: z.string().max(60).optional(),
  landmark: z.string().max(160).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  position_accuracy_m: z.number().min(0).max(50000).optional(),
  observed_at: z.string().max(40).optional(),
  photo_uri: z.string().max(500).optional(),
  photo_uris: z.array(z.string().max(500)).max(5).optional(),
  water_depth_m: z.number().min(0).max(30).optional(),
  road_blocked: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  place_name: z.string().max(200).optional(),
});

export const createCommunityReport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(createReportInput, data);
    const record = await context.getBase44().entities.CommunityReport.create({
      ...input,
      status: "pending",
      source: "community_report",
    });
    return { report: record };
  });

const reviewInput = z.object({
  id: z.string().min(1).max(80),
  action: z.enum(["verify", "reject", "duplicate", "promote"]),
  note: z.string().max(600).optional(),
});

export const reviewCommunityReport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    requireAdmin(context);
    const input = parse(reviewInput, data);
    const base44 = context.getBase44();
    const report = await base44.entities.CommunityReport.get(input.id);

    const status = input.action === "verify" || input.action === "promote" ? "verified" : input.action === "reject" ? "rejected" : "duplicate";
    const patch = {
      status,
      verified_at: new Date().toISOString(),
      verified_by_label: context.user.email,
      verification_note: input.note ?? null,
    };

    let promoted = null;
    if (input.action === "promote") {
      promoted = await base44.entities.Hazard.create({
        title: report.title,
        hazard_type: report.hazard_type,
        severity: report.severity,
        data_class: "observed",
        district: report.district,
        lat: report.lat,
        lng: report.lng,
        radius_km: 0.5,
        extent_notes: "Promoted from a verified community report. Extent is the reported point, not a surveyed boundary.",
        started_at: report.observed_at ?? report.created_date,
        last_update: new Date().toISOString(),
        review_status: "active",
        source: `community report verified by ${context.user.email}`,
        verification_status: "verified",
        confidence: 0.7,
        precautions: ["Avoid the reported location until an official inspection confirms it is clear."],
        description: report.description,
        is_demonstration: false,
      });
      patch.promoted_hazard_id = promoted.id;
    }

    const updated = await base44.entities.CommunityReport.update(input.id, patch);
    return { report: updated, promoted_hazard: promoted };
  });

// ------------------------------------------------------------------- alerts

const alertInput = z.object({ district: z.string().max(60).optional() }).optional();

export const listAlertFeed = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(alertInput, data);
    const res = await context.getBase44().entities.Alert.list({ limit: 80, sort: "-issued_at" });
    const items = pageItems(res);
    const filtered =
      input.district && input.district !== "all"
        ? items.filter((a) => (a.districts ?? []).length === 0 || (a.districts ?? []).includes(input.district))
        : items;
    return { alerts: filtered, count: filtered.length, official_count: filtered.filter((a) => a.is_official).length };
  });

export const getAlertSubscription = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const res = await context
      .getBase44()
      .entities.AlertSubscription.filter({ created_by_id: context.user.id }, { limit: 1 });
    const items = pageItems(res);
    return { subscription: items[0] ?? null };
  });

const subscriptionInput = z.object({
  districts: z.array(z.string().max(60)).max(38),
  hazard_types: z.array(z.string().max(40)).max(12),
  channels: z.array(z.enum(["in_app", "browser_push", "sms"])).max(3),
  min_severity: z.enum(["low", "caution", "elevated", "severe"]),
  sms_number: z.string().max(20).optional(),
  saved_locations: z
    .array(
      z.object({
        label: z.string().max(120),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius_km: z.number().min(0.5).max(60),
      }),
    )
    .max(10)
    .optional(),
});

export const saveAlertSubscription = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(subscriptionInput, data);
    const base44 = context.getBase44();
    const existing = pageItems(
      await base44.entities.AlertSubscription.filter({ created_by_id: context.user.id }, { limit: 1 }),
    );

    // SMS stays unverified until a provider is connected and the number is confirmed.
    const verified = (input.channels ?? []).filter((c) => c !== "sms");
    const payload = {
      ...input,
      verified_channels: verified,
      consent_given_at: new Date().toISOString(),
      push_enabled: (input.channels ?? []).includes("browser_push"),
    };

    if (existing[0]) {
      const updated = await base44.entities.AlertSubscription.update(existing[0].id, payload);
      return { subscription: updated, created: false };
    }
    const created = await base44.entities.AlertSubscription.create(payload);
    return { subscription: created, created: true };
  });

// ------------------------------------------------------------- data sources

export const listDataSources = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const res = await context.getBase44().entities.DataSource.list({ limit: 60 });
    const sources = pageItems(res);
    const nowMs = Date.now();
    return {
      sources: sources.map((s) => ({
        ...s,
        staleness_hours: s.last_success_at ? Math.round((nowMs - Date.parse(s.last_success_at)) / 3_600_000) : null,
      })),
      connected: sources.filter((s) => s.access_status === "connected").length,
      total: sources.length,
      google: googleStatus(),
    };
  });

// ---------------------------------------------------------------- analytics

const analyticsInput = z
  .object({
    district: z.string().max(60).optional(),
    hazard_types: z.array(z.string().max(40)).max(12).optional(),
  })
  .optional();

export const getAnalyticsSummary = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = data ?? {};
    const base44 = context.getBase44();

    const query = {};
    if (input.district && input.district !== "all") query.district = input.district;
    const hazardFilter =
      input.hazard_types?.length > 1
        ? { ...query, hazard_type: { $in: input.hazard_types } }
        : input.hazard_types?.length === 1
          ? { ...query, hazard_type: input.hazard_types[0] }
          : query;

    const [
      byType,
      byDistrict,
      bySeverity,
      byDataClass,
      reportStatus,
      planCount,
      hazardCount,
      runs,
      sources,
      hazardTrend,
      alertBySeverity,
      alertTrend,
      alertCount,
    ] = await Promise.all([
      base44.entities.Hazard.aggregate({ query: hazardFilter, groupBy: "hazard_type" }),
      base44.entities.Hazard.aggregate({ query: hazardFilter, groupBy: "district" }),
      base44.entities.Hazard.aggregate({ query: hazardFilter, groupBy: "severity" }),
      base44.entities.Hazard.aggregate({ query: hazardFilter, groupBy: "data_class" }),
      base44.entities.CommunityReport.aggregate({ groupBy: "status" }),
      base44.entities.RoutePlan.count(),
      base44.entities.Hazard.count(hazardFilter),
      base44.entities.SimulationRun.list({ limit: 12, sort: "-created_date" }),
      base44.entities.DataSource.list({ limit: 60 }),
      base44.entities.Hazard.aggregate({ query: hazardFilter, dateBucket: { field: "created_date", unit: "day" } }),
      base44.entities.Alert.aggregate({ groupBy: "severity" }),
      base44.entities.Alert.aggregate({ dateBucket: { field: "created_date", unit: "day" } }),
      base44.entities.Alert.count(),
    ]);

    const nowMs = Date.now();
    const sourceList = pageItems(sources).map((s) => ({
      ...s,
      staleness_hours: s.last_success_at ? Math.round((nowMs - Date.parse(s.last_success_at)) / 3_600_000) : null,
    }));
    const connectedSources = sourceList.filter((s) => s.access_status === "connected").length;
    const staleSources = sourceList.filter((s) => s.staleness_hours != null && s.staleness_hours > 24).length;

    const reportRows = reportStatus?.rows ?? [];
    const totalReports = reportRows.reduce((sum, r) => sum + (r.count ?? 0), 0);
    const verifiedReports = reportRows.find((r) => r.status === "verified")?.count ?? 0;

    return {
      hazards_by_type: byType?.rows ?? [],
      hazards_by_district: (byDistrict?.rows ?? []).slice(0, 38),
      hazards_by_severity: bySeverity?.rows ?? [],
      hazards_by_data_class: byDataClass?.rows ?? [],
      hazards_trend: hazardTrend?.rows ?? [],
      reports_by_status: reportRows,
      alerts_by_severity: alertBySeverity?.rows ?? [],
      alerts_trend: alertTrend?.rows ?? [],
      alert_total: alertCount,
      saved_plans: planCount,
      hazard_total: hazardCount,
      simulation_runs: pageItems(runs),
      sources: sourceList,
      source_freshness: {
        connected: connectedSources,
        stale: staleSources,
        total: sourceList.length,
      },
      verification_rate: totalReports > 0 ? Math.round((verifiedReports / totalReports) * 100) : 0,
      total_reports: totalReports,
    };
  });

// --------------------------------------------------------------- simulation

export const getSimulationNetwork = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const network = await loadFullNetwork(context.getBase44());
    return simulationNetwork(network);
  });

const runInput = z.object({
  scenario_key: z.string().max(60),
  scenario_label: z.string().min(3).max(160),
  mode: z.string().max(40),
  sample_count: z.number().min(1).max(5000),
  noise_sigma_m: z.number().min(0).max(5000),
  dropout_ratio: z.number().min(0).max(1),
  drift_m_per_min: z.number().min(0).max(500),
  methods: z
    .array(
      z.object({
        key: z.string().max(40),
        label: z.string().max(80),
        mean_error_m: z.number().min(0).max(100000),
        p95_error_m: z.number().min(0).max(100000),
        road_accuracy: z.number().min(0).max(1),
        recovery_time_s: z.number().min(0).max(100000),
        uncertainty_coverage: z.number().min(0).max(1),
      }),
    )
    .max(6),
  notes: z.string().max(600).optional(),
});

export const saveSimulationRun = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(runInput, data);
    const record = await context.getBase44().entities.SimulationRun.create({
      ...input,
      ground_truth: "synthetic_ground_truth",
      engine_version: ENGINE_VERSION,
      is_demonstration: true,
    });
    return { run: record };
  });

export const listSimulationRuns = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const res = await context.getBase44().entities.SimulationRun.list({ limit: 20, sort: "-created_date" });
    return { runs: pageItems(res) };
  });

// ------------------------------------------------------------- maps config

export const getMapsConfig = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async () => readMapsConfig());

// ------------------------------------------------------------- system info

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const [segRes, hazRes, placeRes, shelterRes, sourceRes] = await Promise.all([
      base44.entities.RoadSegment.list({ limit: 400 }),
      base44.entities.Hazard.list({ limit: 300 }),
      base44.entities.Place.list({ limit: 400 }),
      base44.entities.Shelter.list({ limit: 300 }),
      base44.entities.DataSource.list({ limit: 60 }),
    ]);
    const segments = pageItems(segRes);
    return {
      google: googleStatus(),
      counts: {
        places: pageItems(placeRes).length,
        segments: segments.length,
        demonstration_segments: segments.filter((s) => s.is_demonstration).length,
        hazards: pageItems(hazRes).length,
        shelters: pageItems(shelterRes).length,
        sources: pageItems(sourceRes).length,
      },
      engine_version: ENGINE_VERSION,
      demo_network_distance_km: Number(
        segments.reduce((sum, s) => sum + (num(s.distance_km, 0) ?? 0), 0).toFixed(1),
      ),
    };
  });

// --------------------------------------------------------------- rescue beacon

function makeRescueId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return "RB-" + out;
}

const beaconInput = z.object({
  position_source: z.enum(["gps_confirmed", "manual", "last_known"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(50000).optional(),
  fix_timestamp: z.string().max(40).optional(),
  message: z.string().max(500).optional(),
  contact_name: z.string().max(160).optional(),
  contact_phone: z.string().max(40).optional(),
});

export const createRescueBeacon = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const input = parse(beaconInput, data);
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour retention
    const record = await context.getBase44().entities.RescueBeacon.create({
      rescue_id: makeRescueId(),
      position_source: input.position_source,
      lat: input.lat,
      lng: input.lng,
      accuracy_m: input.accuracy_m ?? null,
      fix_timestamp: input.fix_timestamp ?? now.toISOString(),
      message: input.message ?? null,
      contact_name: input.contact_name ?? null,
      contact_phone: input.contact_phone ?? null,
      status: "active",
      expires_at: expires.toISOString(),
    });
    return { beacon: record };
  });

const beaconIdInput = z.object({ id: z.string().min(1).max(80) });

export const revokeRescueBeacon = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const { id } = parse(beaconIdInput, data);
    const updated = await context
      .getBase44()
      .entities.RescueBeacon.update(id, { status: "revoked", revoked_at: new Date().toISOString() });
    return { beacon: updated };
  });

export const listRescueBeacons = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const res = await context
      .getBase44()
      .entities.RescueBeacon.filter({ created_by_id: context.user.id }, { limit: 20, sort: "-created_date" });
    return { beacons: pageItems(res) };
  });