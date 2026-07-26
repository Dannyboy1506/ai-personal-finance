import { getApiBaseUrl } from '@/services/apiConfig';
import type { PeriodSummary } from '@/context/FinanceContext';

/**
 * Tier 3: Google Gemini strategic financial audit, proxied through our own
 * backend (artifacts/api-server). The client never holds a Gemini key.
 * Supports Weekly (quick, Flash) through Yearly (deep, Pro) reviews — the
 * server picks the model and response length based on `summary.period`.
 */
export async function runGeminiAudit(summary: PeriodSummary): Promise<string> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return 'Backend not configured. Set EXPO_PUBLIC_API_BASE_URL to enable AI audits.';
  }

  // Longer-range reviews (quarterly/half-yearly/yearly) run on a more capable
  // model server-side and can legitimately take longer to respond.
  const isLongRange = summary.period !== 'WEEKLY';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), isLongRange ? 25000 : 15000);

  try {
    const response = await fetch(`${baseUrl}/api/audit`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    });

    clearTimeout(timeout);

    const data = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;

    if (!response.ok) {
      return data?.text || `Audit unavailable (server error ${response.status}). Check your connection and try again.`;
    }

    return data?.text || 'Unable to generate audit at this time. Try again shortly.';
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return isAbort
      ? 'Audit timed out. Check your internet connection and try again.'
      : 'Unable to reach the server. Please check your connection and try again.';
  }
}
