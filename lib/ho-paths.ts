/** PAP-1594 / PAP-1592 / Epic PAP-223 — Core-backed HO Path (read-only).
 * Only the four commercial Path codes are exposed to this Founder-only directory.
 */
import type { BoRecord } from "./bo-registration";

const commercialGroup: Record<string, "Art" | "Music"> = {
  artchitect: "Art",
  pianohouse: "Music",
  "little-piner-art": "Art",
  "little-piner-piano": "Music",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallback = "—";

/** SOP 05 V3.3: Core instant → 24-hour Vietnamese time; never slice UTC text.
 * SQLite D1 CURRENT_TIMESTAMP has no zone marker but stores UTC.
 */
export function formatHoAuditTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const source = value.trim();
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(source)
    ? source.replace(" ", "T") + "Z" : source;
  const instant = new Date(utc);
  if (!Number.isFinite(instant.getTime())) return fallback;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  const [day, month, year, hour, minute] = ["day","month","year","hour","minute"].map(get);
  return [day,month,year,hour,minute].every(Boolean)
    ? `${day}/${month}/${year} · ${hour}:${minute}` : fallback;
}

/** The present Core path_programs projection carries no audit actor fields.
 * A future actor name must come from a separately verified CCCD identity contract.
 * Reject unsupported Core displayName/email/login/actor-ID substitutions.
 */
function verifiedLegalName(row: Record<string, unknown>, operation: "createdBy" | "updatedBy"): string {
  const trusted = row[`${operation}UserLegalNameVerified`] === true;
  const name = row[`${operation}UserLegalName`];
  return trusted && typeof name === "string" && name.trim() &&
    !name.includes("@") && !uuid.test(name.trim()) ? name.trim() : fallback;
}

export type HoPathRow = BoRecord & {
  code: string;
  group: "Art" | "Music";
  status: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export function mapHoPaths(value: unknown): HoPathRow[] {
  if (!value || typeof value !== "object" || !("paths" in value) || !Array.isArray(value.paths))
    throw new Error("Danh sách Path từ Core không hợp lệ.");
  const seen = new Set<string>();
  const rows: HoPathRow[] = [];
  for (const item of value.paths) {
    if (!item || typeof item !== "object") throw new Error("Bản ghi Path không hợp lệ.");
    const row = item as Record<string, unknown>;
    if (typeof row.code !== "string") throw new Error("Mã Path không hợp lệ.");
    if (!Object.hasOwn(commercialGroup, row.code)) continue;
    if (typeof row.id !== "string" || !uuid.test(row.id) ||
        typeof row.displayName !== "string" || !row.displayName.trim() ||
        typeof row.status !== "string" || !row.status.trim() ||
        seen.has(row.id)) throw new Error("Bản ghi Path Canon không hợp lệ hoặc bị trùng.");
    seen.add(row.id);
    rows.push({
      id: row.id, name: row.displayName.trim(), code: row.code,
      group: commercialGroup[row.code]!, status: row.status,
      createdAt: formatHoAuditTime(row.createdAt),
      createdBy: verifiedLegalName(row, "createdBy"),
      updatedAt: formatHoAuditTime(row.updatedAt),
      updatedBy: verifiedLegalName(row, "updatedBy"),
    });
  }
  return rows.sort((a,b)=>a.name.localeCompare(b.name,"vi"));
}
