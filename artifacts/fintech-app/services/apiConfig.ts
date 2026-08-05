/**
 * Base URL of artifacts/api-server, e.g. "https://your-api.example.com".
 * This is safe to be a public (EXPO_PUBLIC_) value — it's just a URL, not a
 * secret. The actual OpenRouter/Gemini API keys live only on the server.
 *
 * Set EXPO_PUBLIC_API_BASE_URL in your .env (see .env.example). Returns null
 * if unset so callers can fail gracefully instead of hitting "undefined/api/...".
 */
export function getApiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!raw || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Whether Tier 2/3 have anywhere to call at all. Callers use this to tell
 * "no backend configured" (an expected, silent setup state — Tier 1 alone
 * is meant to carry the app) apart from "backend configured but the
 * request failed" (a real connectivity/server problem worth surfacing to
 * the user as an offline/error state). Conflating the two used to mean a
 * fresh install with no backend set up would show a misleading "Offline"
 * banner on every fast-log attempt.
 */
export function isBackendConfigured(): boolean {
  return getApiBaseUrl() !== null;
}
