// Session-scoped hand-off between modules. Nothing is written to the database
// unless the user explicitly saves, and nothing is kept after the tab closes.

const JOURNEY_KEY = "xmadrl.lastJourney";
const OFFLINE_KEY = "xmadrl.offlineSnapshot";
const PREFS_KEY = "xmadrl.preferences";

export function saveJourney(journey) {
  try {
    window.sessionStorage.setItem(JOURNEY_KEY, JSON.stringify({ at: Date.now(), journey }));
  } catch {
    /* storage unavailable */
  }
}

export function loadJourney() {
  try {
    const raw = window.sessionStorage.getItem(JOURNEY_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.journey ?? null;
  } catch {
    return null;
  }
}

/** Last plan + hazard snapshot, stored locally so the GPS module can work offline. */
export function saveOfflineSnapshot(snapshot) {
  try {
    window.localStorage.setItem(OFFLINE_KEY, JSON.stringify({ at: Date.now(), snapshot }));
  } catch {
    /* storage unavailable */
  }
}

export function loadOfflineSnapshot() {
  try {
    const raw = window.localStorage.getItem(OFFLINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { at: parsed.at, snapshot: parsed.snapshot };
  } catch {
    return null;
  }
}

export function clearOfflineSnapshot() {
  try {
    window.localStorage.removeItem(OFFLINE_KEY);
  } catch {
    /* storage unavailable */
  }
}

const DEFAULT_PREFS = {
  high_contrast: false,
  home_district: "all",
  subscribed_districts: [],
  share_location_for_reports: false,
  keep_location_history: false,
};

export function loadPreferences() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePreferences(prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
}

export function clearPreferences() {
  try {
    window.localStorage.removeItem(PREFS_KEY);
  } catch {
    /* storage unavailable */
  }
}