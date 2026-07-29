import type { Category } from '@/context/FinanceContext';

export interface ParseResult {
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  categoryId: string;
  description: string;
  processedBy: 'ON_DEVICE';
  confidence: number;
  needsConfirmation: boolean;
  timestamp?: string; // ISO — only set when the source text carried its own date (e.g. a bank alert)
}

/** Shared keyword-matching used by both free-text and bank-alert parsing. */
function matchExpenseCategory(cleaned: string, categories: Category[]): { categoryId: string; confidence: number } | null {
  let bestCategory: string | null = null;
  let bestConfidence = 0;

  for (const cat of categories) {
    if (cat.type !== 'EXPENSE') continue;
    for (const keyword of cat.keywords) {
      if (keyword.length < 2) continue;
      if (cleaned.includes(keyword)) {
        const keywordConfidence = Math.min(0.6 + keyword.length * 0.04, 0.95);
        if (keywordConfidence > bestConfidence) {
          bestConfidence = keywordConfidence;
          bestCategory = cat.id;
        }
      }
    }
  }

  return bestCategory ? { categoryId: bestCategory, confidence: bestConfidence } : null;
}

/**
 * Recognizes structured bank/fintech debit-alert text — the
 * "Acct:.../Amt:.../Desc:.../Bal:.../Date:..." style used by most Nigerian
 * banks and fintechs (GTBank, Access, OPay, Kuda, Zenith, etc. all use very
 * similar field-labeled formats). When it matches, amount and transaction
 * type come directly from explicit fields rather than being guessed, so
 * confidence is much higher than free-text parsing.
 */
function tryParseBankAlert(input: string, categories: Category[]): ParseResult | null {
  const labelCount = ['acct', 'amt', 'desc', 'bal', 'date'].filter((label) =>
    new RegExp(`\\b${label}\\s*:`, 'i').test(input),
  ).length;
  if (labelCount < 3) return null; // not confidently a labeled bank alert

  const amtMatch = input.match(/amt\s*:\s*(?:ngn|₦|n)?\s*([\d,]+(?:\.\d{1,2})?)\s*(dr|cr)?/i);
  if (!amtMatch) return null;

  const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;

  // DR = debit (money out), CR = credit (money in). If the suffix is
  // missing, fall back to the word "credit"/"debit" appearing elsewhere.
  const drCr = amtMatch[2]?.toUpperCase();
  const type: 'CREDIT' | 'DEBIT' =
    drCr === 'CR' ? 'CREDIT' : drCr === 'DR' ? 'DEBIT' : /\bcredit\b/i.test(input) ? 'CREDIT' : 'DEBIT';

  const descMatch = input.match(/desc\s*:\s*(.+?)(?:\n|bal\s*:|date\s*:|$)/i);
  const description = descMatch ? descMatch[1].trim().replace(/\s+/g, ' ') : 'Bank transaction';

  // "2026-07-28 10:07PM" / "2026-07-28 10:07 PM" style timestamp, if present.
  const dateMatch = input.match(/date\s*:\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let timestamp: string | undefined;
  if (dateMatch) {
    const [, y, mo, d, hRaw, mi, ampm] = dateMatch;
    let h = parseInt(hRaw, 10) % 12;
    if (ampm.toUpperCase() === 'PM') h += 12;
    const parsed = new Date(Number(y), Number(mo) - 1, Number(d), h, Number(mi));
    if (!Number.isNaN(parsed.getTime())) timestamp = parsed.toISOString();
  }

  if (type === 'CREDIT') {
    return {
      amount,
      type,
      categoryId: 'cat_income',
      description,
      processedBy: 'ON_DEVICE',
      confidence: 0.95,
      needsConfirmation: false,
      timestamp,
    };
  }

  const match = matchExpenseCategory(description.toLowerCase(), categories);
  return {
    amount,
    type,
    categoryId: match?.categoryId ?? 'cat_general',
    description,
    processedBy: 'ON_DEVICE',
    // The amount/type came from explicit fields (high confidence either way);
    // only the *category* guess needs review if keyword matching came up empty.
    confidence: match ? Math.max(match.confidence, 0.85) : 0.5,
    needsConfirmation: !match,
    timestamp,
  };
}

/**
 * Tier 1: On-device parsing engine.
 * Tries structured bank-alert parsing first (see tryParseBankAlert), then
 * falls back to free-text regex + learned keyword map. Zero network, zero
 * latency. Returns null when no confident match — caller should escalate
 * to Tier 2.
 */
export function parseLocally(input: string, categories: Category[]): ParseResult | null {
  const bankAlert = tryParseBankAlert(input, categories);
  if (bankAlert) return bankAlert;

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
  const match = matchExpenseCategory(cleaned, categories);
  if (!match) return null; // No match — escalate to Tier 2

  return {
    amount,
    type,
    categoryId: match.categoryId,
    description: input.trim(),
    processedBy: 'ON_DEVICE',
    confidence: match.confidence,
    needsConfirmation: match.confidence < 0.7,
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
