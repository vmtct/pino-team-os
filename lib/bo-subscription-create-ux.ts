/** PAP-1034 — local calendar/business discount UX helpers, no pricing authority. */
export type DiscountInputMode = "amount" | "percent";
const DAY_MS = 86_400_000;

export function suggestedContractSunday(start: string, termWeeks: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isSafeInteger(termWeeks) || termWeeks < 1) return "";
  const [year, month, day] = start.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return "";
  value.setTime(value.getTime() + termWeeks * 7 * DAY_MS);
  value.setUTCDate(value.getUTCDate() + (7 - value.getUTCDay()) % 7);
  return value.toISOString().slice(0, 10);
}
export function amountFromPercent(base: number, percent: number): number {
  if (!Number.isSafeInteger(base) || base < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100) return NaN;
  return Math.round(base * percent / 100);
}
export function percentFromAmount(base: number, amount: number): number {
  if (!Number.isSafeInteger(base) || base < 0 || !Number.isSafeInteger(amount) || amount < 0 || amount > base) return NaN;
  return base ? Math.round(amount / base * 10_000) / 100 : 0;
}
export function quoteAfterDiscounts(gross: number, item: number, bill: number) {
  const valid = Number.isSafeInteger(gross) && Number.isSafeInteger(item) && Number.isSafeInteger(bill)
    && gross >= 0 && item >= 0 && item <= gross && bill >= 0 && bill <= gross - item;
  return { valid, gross, afterItem: gross - item, net: gross - item - bill };
}
