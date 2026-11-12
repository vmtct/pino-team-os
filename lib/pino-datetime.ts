/** PAP-1895 · PAP-1820 / PINO DS — canonical, timezone-stable UI datetime v1.
 * This is presentation only. Preserve original Core RFC3339 values for APIs/audit.
 */
export const PINO_DATETIME_CONTRACT = "PINO_DATETIME_V1" as const;
const zone = "Asia/Ho_Chi_Minh";
const instant = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const calendar = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function validCalendar(y: number, m: number, d: number): boolean {
  return Number.isInteger(y) && y >= 1 && y <= 9999 && m >= 1 && m <= 12 &&
    d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function validDateTime(v: string): boolean {
  const match = instant.exec(v);
  if (!match) return false;
  const [y, m, d, h, minute, s] = match.slice(1, 7).map(Number);
  if (!validCalendar(y, m, d) || h > 23 || minute > 59 || s > 59) return false;
  const offset = match[7]!;
  if (offset !== "Z") {
    const hours = Number(offset.slice(1, 3)), minutes = Number(offset.slice(4));
    if (hours > 23 || minutes > 59) return false;
  }
  return Number.isFinite(Date.parse(v));
}
export function formatPinoDateTime(value: unknown): string {
  if (typeof value !== "string" || !validDateTime(value)) return "—";
  const parts = formatter.formatToParts(new Date(value));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
}
export function formatPinoDateOnly(value: unknown): string {
  if (typeof value !== "string") return "—";
  const m = calendar.exec(value);
  if (!m || !validCalendar(Number(m[1]), Number(m[2]), Number(m[3]))) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
export function formatPinoTimeOnly(value: unknown): string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return "—";
  const [hour, minute] = value.split(":").map(Number);
  return hour <= 23 && minute <= 59 ? value : "—";
}
