import AsyncStorage from '@react-native-async-storage/async-storage';

const OVERRIDE_KEY = 'api_base_url_override';
const TIER2_MODEL_KEY = 'tier2_model_override';
const TIER3_MODEL_KEY = 'tier3_model_override';

// In-memory cache of user-set overrides, loaded once at startup by
// loadApiBaseUrlOverride()/loadModelOverrides(). Kept as plain module-level
// variables (not React state) so the getters can stay synchronous functions —
// every existing call site already calls them that way, and AsyncStorage
// reads are async, so this cache is what bridges the two without a wider
// refactor.
let cachedOverride: string | null = null;
let cachedTier2Model: string | null = null;
let cachedTier3Model: string | null = null;

function clean(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Loads any user-set backend URL from disk into memory. Call once during
 * app startup (FinanceContext's load effect does this) so getApiBaseUrl()
 * has it available immediately, synchronously, everywhere else.
 */
export async function loadApiBaseUrlOverride(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(OVERRIDE_KEY);
    cachedOverride = stored && stored.trim() ? clean(stored) : null;
  } catch {
    cachedOverride = null;
  }
}

/**
 * Sets (or clears, with null/empty) the backend URL the user typed into
 * Settings. This is what makes the backend URL changeable without
 * rebuilding the app — EXPO_PUBLIC_API_BASE_URL is baked in at build time
 * and can't change after the APK exists, but a URL saved here takes
 * priority over it immediately, for the rest of this session and every
 * session after (persisted to disk).
 */
export async function setApiBaseUrlOverride(url: string | null): Promise<void> {
  const cleaned = url && url.trim() ? clean(url) : null;
  cachedOverride = cleaned;
  if (cleaned) {
    await AsyncStorage.setItem(OVERRIDE_KEY, cleaned);
  } else {
    await AsyncStorage.removeItem(OVERRIDE_KEY);
  }
}

/** The raw override string, or null if none is set. For displaying in Settings. */
export function getApiBaseUrlOverride(): string | null {
  return cachedOverride;
}

/**
 * Base URL of artifacts/api-server. Checks, in order:
 *  1. A URL saved from Settings on this device (no rebuild needed to change it)
 *  2. EXPO_PUBLIC_API_BASE_URL, baked in at build time via .env
 * Returns null if neither is set, so callers fail gracefully instead of
 * hitting "undefined/api/...".
 */
export function getApiBaseUrl(): string | null {
  if (cachedOverride) return cachedOverride;
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!raw || !raw.trim()) return null;
  return clean(raw);
}

/**
 * Whether Tier 2/3 have anywhere to call at all. Callers use this to tell
 * "no backend configured" (an expected, silent setup state — Tier 1 alone
 * is meant to carry the app) apart from "backend configured but the
 * request failed" (a real connectivity/server problem worth surfacing to
 * the user as an offline/error state).
 */
export function isBackendConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

/**
 * Loads any user-set Tier 2/3 model overrides from disk into memory. Call
 * once during app startup, same as loadApiBaseUrlOverride().
 */
export async function loadModelOverrides(): Promise<void> {
  try {
    const [t2, t3] = await Promise.all([
      AsyncStorage.getItem(TIER2_MODEL_KEY),
      AsyncStorage.getItem(TIER3_MODEL_KEY),
    ]);
    cachedTier2Model = t2 && t2.trim() ? t2.trim() : null;
    cachedTier3Model = t3 && t3.trim() ? t3.trim() : null;
  } catch {
    cachedTier2Model = null;
    cachedTier3Model = null;
  }
}

/** Sets (or clears, with null/empty) which model Tier 2 (OpenRouter) requests. */
export async function setTier2ModelOverride(model: string | null): Promise<void> {
  const cleaned = model && model.trim() ? model.trim() : null;
  cachedTier2Model = cleaned;
  if (cleaned) await AsyncStorage.setItem(TIER2_MODEL_KEY, cleaned);
  else await AsyncStorage.removeItem(TIER2_MODEL_KEY);
}

/** Sets (or clears, with null/empty) which Gemini model Tier 3 requests. */
export async function setTier3ModelOverride(model: string | null): Promise<void> {
  const cleaned = model && model.trim() ? model.trim() : null;
  cachedTier3Model = cleaned;
  if (cleaned) await AsyncStorage.setItem(TIER3_MODEL_KEY, cleaned);
  else await AsyncStorage.removeItem(TIER3_MODEL_KEY);
}

export function getTier2ModelOverride(): string | null {
  return cachedTier2Model;
}

export function getTier3ModelOverride(): string | null {
  return cachedTier3Model;
}
