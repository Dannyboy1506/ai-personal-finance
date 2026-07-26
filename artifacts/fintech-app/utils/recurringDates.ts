export type RecurringFrequency = 'WEEKLY' | 'MONTHLY';

/**
 * Returns the last valid day-of-month for the given year/month (0-indexed month),
 * so e.g. a "31st of every month" rule correctly lands on Feb 28 (or 29 in a leap year).
 */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Given the current scheduled run date, returns the next one for a recurring rule.
 * - WEEKLY: exactly 7 days later (naturally preserves day-of-week).
 * - MONTHLY: same day-of-month next month, clamped to that month's last day.
 */
export function getNextRunDate(
  current: Date,
  frequency: RecurringFrequency,
  dayOfMonth?: number,
): Date {
  if (frequency === 'WEEKLY') {
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    return next;
  }

  // MONTHLY
  const targetDay = dayOfMonth ?? current.getDate();
  const year = current.getFullYear();
  const month = current.getMonth() + 1;
  const clampedDay = Math.min(targetDay, lastDayOfMonth(year, month));
  return new Date(year, month, clampedDay);
}

/**
 * Computes the first nextRunDate for a brand-new rule, starting from "today"
 * and rolling forward to the next occurrence of the requested day.
 */
export function computeFirstRunDate(
  frequency: RecurringFrequency,
  dayOfMonth?: number,
  dayOfWeek?: number,
): Date {
  const now = new Date();

  if (frequency === 'WEEKLY') {
    const targetDow = dayOfWeek ?? now.getDay();
    const next = new Date(now);
    const diff = (targetDow - now.getDay() + 7) % 7;
    next.setDate(now.getDate() + (diff === 0 ? 7 : diff));
    next.setHours(9, 0, 0, 0);
    return next;
  }

  // MONTHLY
  const targetDay = dayOfMonth ?? now.getDate();
  const thisMonthClamped = Math.min(targetDay, lastDayOfMonth(now.getFullYear(), now.getMonth() + 1));
  let candidate = new Date(now.getFullYear(), now.getMonth(), thisMonthClamped, 9, 0, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate = getNextRunDate(candidate, 'MONTHLY', targetDay);
    candidate.setHours(9, 0, 0, 0);
  }
  return candidate;
}
