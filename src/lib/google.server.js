// Google Maps Platform status.
//
// The key lives in a platform secret and is never sent to the browser. Until it
// is set, the app states plainly that the Google basemap, traffic layer and
// Routes API are off and uses the internal corridor graph instead.

import { secrets } from "base44:runtime";

export const GOOGLE_SECRET_NAME = "GOOGLE_MAPS_API_KEY";

export function googleStatus() {
  let configured = false;
  try {
    configured = Boolean(secrets.get(GOOGLE_SECRET_NAME));
  } catch {
    configured = false;
  }

  return {
    secret_name: GOOGLE_SECRET_NAME,
    configured,
    basemap: configured ? "google_maps_javascript_api" : "openstreetmap_tiles",
    traffic_layer: configured,
    routes_api: configured,
    notice: configured
      ? "A Google Maps Platform key is configured. Google basemap, traffic layer and Routes API calls are authorised for this app."
      : "Google Maps Platform is not configured. The basemap is live OpenStreetMap tiles, no traffic layer is drawn, and routing uses the internal corridor graph. Add a restricted browser key plus a server key to enable the authorised Google paths.",
  };
}

/**
 * Returns the Google Maps API key for client-side use (APIProvider).
 * The key must be browser-visible for the Maps JavaScript API to load.
 * Protect it with HTTP referrer restrictions in Google Cloud Console.
 */
export function readMapsConfig() {
  let apiKey = null;
  try {
    apiKey = secrets.get(GOOGLE_SECRET_NAME);
  } catch {
    apiKey = null;
  }
  const configured = Boolean(apiKey);
  return {
    apiKey,
    configured,
    basemap: configured ? "google_maps_javascript_api" : "openstreetmap_tiles",
    notice: configured
      ? "Google Maps Platform is configured. The map renders with Google Maps tiles."
      : "Google Maps Platform is not configured. The map falls back to OpenStreetMap tiles. Add a restricted browser key to enable the Google Maps basemap.",
  };
}