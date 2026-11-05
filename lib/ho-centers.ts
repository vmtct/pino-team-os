import type { BoModule, BoRecord } from "./bo-registration";
export const hoCentersModule: BoModule = { label: "Centers", group: "Head Office", fields: [
  { key: "name", label: "Display Name", type: "text", icon: "Aa", w: 240, readonly: true },
  { key: "id", label: "ID", type: "id", icon: "#", w: 300, readonly: true },
  { key: "centerKey", label: "Center Key", type: "text", icon: "⌘", w: 180, readonly: true },
  { key: "timeZone", label: "Time Zone", type: "text", icon: "◷", w: 210, readonly: true },
  { key: "status", label: "Status", type: "select", icon: "◉", w: 120, readonly: true },
] };
/** Reject ambiguous/malformed records instead of displaying invented fallback identities. */
export type HoCenterRow = BoRecord & { centerKey: string; timeZone: string; status: string };
export function mapHoCenters(input: unknown): HoCenterRow[] {
  if (!Array.isArray(input)) throw new Error("Dữ liệu Center không hợp lệ.");
  const seen = new Set<string>();
  return input.map(value => {
    if (!value || typeof value !== "object") throw new Error("Dữ liệu Center không hợp lệ.");
    const r = value as Record<string, unknown>;
    if (!["id", "key", "displayName", "timeZone", "status"].every(k => typeof r[k] === "string" && (r[k] as string).trim()) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(r.id)) || seen.has(String(r.id))) throw new Error("Dữ liệu Center không hợp lệ.");
    try { new Intl.DateTimeFormat("en", { timeZone: r.timeZone as string }); } catch { throw new Error("Múi giờ Center không hợp lệ."); }
    seen.add(r.id as string);
    return { id: r.id as string, name: r.displayName as string, centerKey: r.key as string, timeZone: r.timeZone as string, status: r.status as string };
  });
}
