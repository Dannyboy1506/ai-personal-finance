import type { Category } from '@/context/FinanceContext';

export interface ParseResult {
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  categoryId: string;
  description: string;
  processedBy: 'ON_DEVICE';
  confidence: number;
  needsConfirmation: boolean;
}

/**
 * Tier 1: On-device parsing engine.
 * Uses regex + learned keyword map. Zero network, zero latency.
 * Returns null when no confident match — caller should escalate to Tier 2.
 */
export function parseLocally(input: string, categories: Category[]): ParseResult | null {
  const cleaned = input.toLowerCase().trim();

  // 1. Extract amount — support formats: "15", "15.50", "1,500"
  const amountMatch = cleaned.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;

  // 2. Determine transaction type using phrase boundaries
  const creditPatterns = [
    /\breceived\b/,
    /\bsalary\b/,
    /\bgot paid\b/,
    /\bcredit alert\b/,
    /\bdeposit(ed)?\b/,
    /\btransfer in\b/,
    /\brefund(ed)?\b/,
    /\bbonus\b/,
    /\bcashback\b/,
    /\bincome\b/,
    /\bwages\b/,
  ];
  const debitOverrides = [/\bcharged\b/, /\bspent\b/, /\bpaid for\b/, /\bbought\b/];

  const looksLikeCredit =
    creditPatterns.some((p) => p.test(cleaned)) &&
    !debitOverrides.some((p) => p.test(cleaned));

  const type: 'CREDIT' | 'DEBIT' = looksLikeCredit ? 'CREDIT' : 'DEBIT';

  // 3. Credit → always Money In category with high confidence
  if (type === 'CREDIT') {
    return {
      amount,
      type,
      categoryId: 'cat_income',
      description: input.trim(),
      processedBy: 'ON_DEVICE',
      confidence: 0.9,
      needsConfirmation: false,
    };
  }

  // 4. Match against learned keyword map (higher weight = earlier in list)
  let bestCategory: string | null = null;
  let bestConfidence = 0;

  for (const cat of categories) {
    if (cat.type !== 'EXPENSE') continue;
    for (const keyword of cat.keywords) {
      if (keyword.length < 2) continue;
      if (cleaned.includes(keyword)) {
        // Longer, more specific keywords get higher confidence
        const keywordConfidence = Math.min(0.6 + keyword.length * 0.04, 0.95);
        if (keywordConfidence > bestConfidence) {
          bestConfidence = keywordConfidence;
          bestCategory = cat.id;
        }
      }
    }
  }

  if (bestCategory === null) {
    // No match — escalate to Tier 2
    return null;
  }

  return {
    amount,
    type,
    categoryId: bestCategory,
    description: input.trim(),
    processedBy: 'ON_DEVICE',
    confidence: bestConfidence,
    needsConfirmation: bestConfidence < 0.7,
  };
}

/**
 * Extract just the numeric amount from free text. Used for fast-log preview.
 */
export function extractAmount(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const val = parseFloat(match[1].replace(/,/g, ''));
  return val > 0 ? val : null;
}
