import type { Category } from '@/context/FinanceContext';
import { getApiBaseUrl } from '@/services/apiConfig';

export interface AIParseResult {
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  categoryId: string;
  description: string;
  confidence: number;
}

/**
 * Tier 2: fast AI parsing via OpenRouter, proxied through our own backend
 * (artifacts/api-server). The client never holds an OpenRouter key — only
 * the backend does, as a real (non-EXPO_PUBLIC_) environment variable.
 *
 * Returns null on network failure or if the backend isn't reachable/configured
 * (caller falls back to writing the raw input to the offline sync queue).
 */
export async function parseWithOpenRouter(
  userInput: string,
  categories: Category[],
): Promise<AIParseResult | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${baseUrl}/api/parse`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput,
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const parsed = (await response.json()) as Partial<AIParseResult>;
    if (!parsed.type || !parsed.amount || !parsed.categoryId) return null;
    if (parsed.type !== 'CREDIT' && parsed.type !== 'DEBIT') return null;

    return {
      type: parsed.type,
      amount: Number(parsed.amount),
      categoryId: parsed.categoryId,
      description: parsed.description || userInput.trim(),
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0.8, 0), 1),
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
