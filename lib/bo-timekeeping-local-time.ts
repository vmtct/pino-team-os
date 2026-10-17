export function isoToLocalInput(value: string, timeZone: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function localInputToIso(value: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const target = Date.parse(value + ":00Z");
  if (!Number.isFinite(target)) return null;
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const probe = target + delta;
    const local = isoToLocalInput(new Date(probe).toISOString(), timeZone);
    const localMs = Date.parse(local + ":00Z");
    if (Number.isFinite(localMs)) offsets.add(localMs - probe);
  }
  const matches = [...offsets].map((offset) => new Date(target - offset)).filter((instant) => isoToLocalInput(instant.toISOString(), timeZone) === value);
  return matches.length === 1 ? matches[0].toISOString() : null;
}
