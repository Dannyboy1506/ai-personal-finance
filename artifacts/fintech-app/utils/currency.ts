export const CURRENCY_SYMBOL = '₦';

function addThousandsSeparator(numStr: string): string {
  const [intPart, decPart] = numStr.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

/**
 * Formats a number as Naira: ₦1,234.56 — implemented manually rather than
 * via toLocaleString/Intl, since Hermes' ICU data bundling varies by build
 * and isn't guaranteed to include en-NG (or full locale support at all).
 */
export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const isNegative = safe < 0;
  const fixed = Math.abs(safe).toFixed(2);
  const formatted = addThousandsSeparator(fixed);
  return `${isNegative ? '-' : ''}${CURRENCY_SYMBOL}${formatted}`;
}

/** Same as formatCurrency but without the ± sign — for contexts that add their own +/- prefix. */
export function formatCurrencyAbs(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  return `${CURRENCY_SYMBOL}${addThousandsSeparator(safe.toFixed(2))}`;
}

/** Compact form for tight spaces: ₦1,234 (no decimals). */
export function formatCurrencyCompact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const isNegative = safe < 0;
  const whole = Math.round(Math.abs(safe)).toString();
  return `${isNegative ? '-' : ''}${CURRENCY_SYMBOL}${addThousandsSeparator(whole)}`;
}
