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
 * Extracts a leading numeric amount from free text, supporting "15",
 * "15.50", "1,500", and a casual "k" shorthand for thousands ("5k" -> 5000,
 * "1.5k" -> 1500, "100 k" -> 100000). Returns null only when there's no
 * number in the text at all.
 *
 * The leading digit run MUST be `\d+` (unbounded), not `\d{1,3}`. A bounded
 * `\d{1,3}` alternative ahead of a `(?:,\d{3})*` group looks reasonable for
 * matching comma-grouped numbers, but since regex alternation in JS takes
 * the first alternative that matches rather than the longest, `\d{1,3}`
 * happily matches just the first 1–3 digits of a plain, comma-less number
 * and stops there — silently truncating "15000" to "150". Naira amounts
 * are routinely typed without thousands separators ("spent 15000 on
 * rent"), so that bug would corrupt a large fraction of real input, and do
 * it at high confidence with no visible warning. `\d+` greedily consumes
 * the whole run first, so both "15000" and "1,500,000" parse correctly
 * through the same pattern.
 */
function parseAmountToken(cleaned: string): number | null {
  const match = cleaned.match(/(\d+(?:,\d{3})*(?:\.\d{1,2})?)(\s?k\b)?/i);
  if (!match) return null;
  const base = parseFloat(match[1].replace(/,/g, ''));
  if (!base || base <= 0) return null;
  return match[2] ? base * 1000 : base;
}

/**
 * Tier 1: On-device parsing engine.
 * Tries structured bank-alert parsing first (see tryParseBankAlert), then
 * falls back to free-text regex + learned keyword map. Zero network, zero
 * latency. Returns null only when no amount could be found at all — for
 * everything else (including an unmatched category) it returns its best
 * guess rather than giving up, since this app has to work end-to-end with
 * no backend configured. A category miss just means lower confidence and
 * needsConfirmation: true, not a dead end.
 */
export function parseLocally(input: string, categories: Category[]): ParseResult | null {
  const bankAlert = tryParseBankAlert(input, categories);
  if (bankAlert) return bankAlert;

  const cleaned = input.toLowerCase().trim();

  // 1. Extract amount — support formats: "15", "15.50", "1,500", "5k"
  const amount = parseAmountToken(cleaned);
  if (!amount) return null;

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

  // 4. Match against learned keyword map (higher weight = earlier in list).
  // No match doesn't mean no result — amount and direction are already
  // solid, so fall back to General Expenses at lower confidence instead of
  // bailing out. This is what keeps "Parse with AI" always producing a
  // usable, editable draft instead of silently failing whenever the text
  // doesn't happen to hit a known keyword.
  const match = matchExpenseCategory(cleaned, categories);

  return {
    amount,
    type,
    categoryId: match?.categoryId ?? 'cat_general',
    description: input.trim(),
    processedBy: 'ON_DEVICE',
    confidence: match?.confidence ?? 0.4,
    needsConfirmation: !match || match.confidence < 0.7,
  };
}

/**
 * Extract just the numeric amount from free text (including the "5k" style
 * shorthand). Used for fast-log preview.
 */
export function extractAmount(text: string): number | null {
  return parseAmountToken(text.toLowerCase());
}
