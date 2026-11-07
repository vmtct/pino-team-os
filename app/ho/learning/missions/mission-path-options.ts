/**
 * PAP-1207 / Epic PAP-1188 / MISSION — Staging S2 Create Path selector.
 * Reuses the existing Founder-authorized, Core-backed HO Path directory.
 * Only commercial canonical CODES are fixed here; identities and names come
 * from the live read-only Core projection. Never seed, cache or invent IDs.
 */
import { mapHoPaths } from "@/lib/ho-paths";
import type { MissionInput } from "./command";

const canonicalLabels = {
  artchitect: "Artchitect",
  pianohouse: "PianoHouse",
  "little-piner-art": "Little Piner Art",
  "little-piner-piano": "Little Piner Piano",
} as const;
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MissionPathChoice = Readonly<{
  id: string;
  code: keyof typeof canonicalLabels;
  label: string;
}>;

/** Fail closed on unavailable, inactive, duplicate or incomplete Core canon. */
export async function loadMissionPathChoices(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<readonly MissionPathChoice[]> {
  const response = await fetcher("/api/ho/learning/paths", {
    method: "GET", credentials: "same-origin", cache: "no-store",
    redirect: "error", signal,
  });
  if (!response.ok) throw new Error("Không có quyền hoặc không tải được Path từ Core.");
  const envelope: unknown = await response.json();
  if (!envelope || typeof envelope !== "object" || !("data" in envelope))
    throw new Error("Danh sách Path từ Core không hợp lệ.");
  // Live HO Path API returns { data: Path[] }. Retain compatible legacy { data: { paths } }
  // while reusing the strict source-owned Path validator; never fabricate Path identities.
  const rows = mapHoPaths(Array.isArray(envelope.data) ? { paths: envelope.data } : envelope.data);
  const seenCodes = new Set<string>();
  const seenIds = new Set<string>();
  if (rows.length !== 4) throw new Error("Chưa đủ bốn Path canonical được xác minh.");
  const choices: MissionPathChoice[] = [];
  for (const row of rows) {
    if (!Object.hasOwn(canonicalLabels, row.code) ||
        !uuidV7.test(row.id) ||
        row.name !== canonicalLabels[row.code as keyof typeof canonicalLabels] ||
        row.status !== "ACTIVE" || seenCodes.has(row.code) || seenIds.has(row.id))
      throw new Error("Path canonical đã thay đổi; không cho tạo Mission với lựa chọn chưa xác minh.");
    seenCodes.add(row.code);
    seenIds.add(row.id);
    choices.push({ id: row.id, code: row.code as MissionPathChoice["code"], label: row.name });
  }
  return choices.sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

/** Require exact atomic ID + snapshot code from a fresh, authorized Core read. */
export function validateMissionSelectedPath(
  value: Pick<MissionInput, "pathProgramId" | "pathKeySnapshot">,
  choices: readonly MissionPathChoice[],
): string | null {
  if (choices.length !== 4) return "Chưa xác minh đủ bốn Path từ Core.";
  if (!value.pathProgramId || !value.pathKeySnapshot)
    return "Vui lòng chọn Path.";
  return choices.some(choice => choice.id === value.pathProgramId &&
    choice.code === value.pathKeySnapshot)
    ? null
    : "Path đã thay đổi hoặc không thuộc bốn Path canonical. Tải lại form trước khi tạo.";
}
