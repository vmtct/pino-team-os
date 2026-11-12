/** PAP-1814 · Epic PAP-1384 / SCH-PARENTS-GUARDIANS.
 * Native Core-bound BO Parent reader/writer: no TDD schema, registry or adapter.
 */
import { BoApiError } from "@/lib/bo-api-error";
import type { BoRecord } from "@/lib/bo-registration";
import { loadAuthorizedDirectoryCenters } from "@/app/bo/pinoria-avatars/centers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed = new Set(["id", "displayName", "version", "maskedContact", "linkedStudentCount",
  "centers", "createdAt", "createdBy", "updatedAt", "updatedBy", "attention"]);
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const fail = (status = 502): never => { throw new BoApiError(status, "Core Parent projection không hợp lệ.", null); };
export const nativeParentUuid = (value: string) => UUID.test(value);

export type NativeParentRow = BoRecord & { version: number | null };
export type NativeParentContext = ReadonlySet<string>;
function object(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail();
  return raw as Record<string, unknown>;
}
function clock(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "string" || !timestamp.test(value) || !Number.isFinite(Date.parse(value))) fail();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(value as string));
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === key)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
}
function actor(value: unknown): string {
  // Core currently returns null for actors. Never fabricate a staff identity.
  if (value !== null && value !== undefined) fail();
  return "—";
}
export function projectNativeParent(raw: unknown): NativeParentRow {
  const row = object(raw);
  if (Object.keys(row).some(key => !allowed.has(key)) ||
    typeof row.id !== "string" || !UUID.test(row.id) ||
    (row.displayName !== null && typeof row.displayName !== "string") ||
    (row.version !== undefined && (!Number.isSafeInteger(row.version) || Number(row.version) < 1)) ||
    (row.maskedContact !== null && (typeof row.maskedContact !== "string" || !/[•*]/.test(row.maskedContact))) ||
    !Number.isSafeInteger(row.linkedStudentCount) || Number(row.linkedStudentCount) < 0 ||
    !Array.isArray(row.centers) || row.centers.some(v => typeof v !== "string" || !v.trim()) ||
    typeof row.updatedAt !== "string" || !timestamp.test(row.updatedAt) || !Number.isFinite(Date.parse(row.updatedAt)) ||
    (row.attention !== null && typeof row.attention !== "string")) fail();
  return {
    id: row.id as string, name: row.displayName === null ? "Chưa có tên" : row.displayName as string,
    version: row.version === undefined ? null : Number(row.version),
    maskedContact: row.maskedContact as string | null,
    studentCount: Number(row.linkedStudentCount),
    centers: (row.centers as string[]).join(", "),
    createdAt: clock(row.createdAt), createdBy: actor(row.createdBy),
    updatedAt: clock(row.updatedAt), updatedBy: actor(row.updatedBy),
    attention: row.attention as string | null,
  };
}
async function read(url: string, signal: AbortSignal, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url, { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal });
  signal.throwIfAborted();
  if (!response.ok) fail(response.status);
  const root: unknown = await response.json();
  return object(root).data;
}
export async function loadNativeParentContext(centerId: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<NativeParentContext> {
  if (!UUID.test(centerId)) fail(403);
  const raw = object(await read("/api/bo/context", signal, fetcher));
  if (raw.surface !== "BO" || raw.entitled !== true || typeof raw.userId !== "string" || !raw.userId.trim() ||
    !Array.isArray(raw.permissionKeys) || raw.permissionKeys.some(x => typeof x !== "string")) fail(403);
  const grants = new Set(raw.permissionKeys as string[]);
  if (!grants.has("team.bo.access") || !grants.has("identity.parent_directory.view")) fail(403);
  const scopes = await loadAuthorizedDirectoryCenters(fetcher, signal);
  if (!scopes.centers.some(c => c.id === centerId)) fail(403);
  return grants;
}
export async function loadNativeParentDirectory(centerId: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<NativeParentRow[]> {
  if (!UUID.test(centerId)) fail(403);
  const result: NativeParentRow[] = [], ids = new Set<string>();
  let total: number | null = null;
  for (let page = 0; page < 100; page++) {
    const offset = page * 100;
    const query = new URLSearchParams({ centerId, limit: "100", offset: String(offset) });
    const data = object(await read("/api/bo/identity/parents/directory?" + query, signal, fetcher));
    if (data.scopeCenterId !== centerId) fail(403);
    if (!Number.isSafeInteger(data.total) || Number(data.total) < 0 || Number(data.total) > 10000 ||
      data.limit !== 100 || data.offset !== offset || !Array.isArray(data.items) || data.items.length > 100 ||
      (total !== null && data.total !== total)) fail();
    total = Number(data.total);
    const items = data.items as unknown[];
    if (items.length === 0 && result.length !== total) fail();
    for (const item of items) {
      const row = projectNativeParent(item);
      if (ids.has(row.id)) fail();
      ids.add(row.id); result.push(row);
    }
    if (result.length === total) return result;
    if (result.length > total || result.length !== offset + items.length) fail();
  }
  return fail();
}
export async function saveNativeParentName(
  centerId: string, current: NativeParentRow, nextValue: string, grants: NativeParentContext,
  signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<NativeParentRow> {
  if (!UUID.test(centerId) || !UUID.test(current.id) || !grants.has("identity.parent.edit")) fail(403);
  const name = nextValue.trim();
  const version = Number(current.version);
  if (!name || name.length > 160 || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) fail(400);
  const url = "/api/bo/identity/parents/" + current.id + "?" + new URLSearchParams({ centerId });
  const response = await fetcher(url, {
    method: "PATCH", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: name, expectedVersion: version }), signal,
  });
  signal.throwIfAborted();
  if (response.status === 409) fail(409);
  if (!response.ok) fail(response.status);
  const receipt = object(object(await response.json()).data);
  if (receipt.id !== current.id || receipt.displayName !== name || receipt.version !== version + 1 || receipt.status !== "ACTIVE") fail();
  const rows = await loadNativeParentDirectory(centerId, signal, fetcher);
  const actual = rows.find(r => r.id === current.id);
  if (!actual || actual.name !== name || actual.version !== version + 1) fail(403);
  return actual as NativeParentRow;
}
