import type { BoRecord } from "./bo-registration";

/** PAP-1594: commercial Path identity is Core-owned. This canon only filters out staging-only fixture Paths. */
const commercialGroup: Record<string, "Art" | "Music"> = {
  artchitect: "Art",
  pianohouse: "Music",
  "little-piner-art": "Art",
  "little-piner-piano": "Music",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallback = "—";

export type HoPathRow = BoRecord & {
  code: string;
  group: "Art" | "Music";
  status: string;
  createdAt: string;
  createdBy: string;
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
    if (!Object.hasOwn(commercialGroup, row.code)) continue; // Test-only Path is not a commercial canon.
    if (typeof row.id !== "string" || !uuid.test(row.id) ||
      typeof row.displayName !== "string" || !row.displayName.trim() ||
      typeof row.status !== "string" || !row.status.trim() ||
      seen.has(row.id)) throw new Error("Bản ghi Path Canon không hợp lệ hoặc bị trùng.");
    seen.add(row.id);
    const createdAt = typeof row.createdAt === "string" && !Number.isNaN(Date.parse(row.createdAt))
      ? row.createdAt : fallback;
    // Core path_programs does not persist created_by. Never guess an actor.
    const createdBy = typeof row.createdByUserName === "string" && row.createdByUserName.trim()
      ? row.createdByUserName : fallback;
    rows.push({
      id: row.id, name: row.displayName.trim(), code: row.code,
      group: commercialGroup[row.code]!, status: row.status,
      createdAt, createdBy,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
