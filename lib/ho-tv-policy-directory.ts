/** PAP-650 / PNR-TV · PAP-1386 / PAP-1419: Founder-only HO Policy Directory.
 * Read via the exact private HO BFF only; never infer rows from physical Devices.
 */
import type { BoModule, BoRecord } from "./bo-registration";

export const tvPolicyColumns = [
  ["name", "Policy", 240], ["typeName", "Loại TV", 165],
  ["scope", "Scope", 135], ["center", "Center", 190],
  ["resolution", "Effective State", 170], ["inherited", "Inherited From", 165],
  ["active", "Active Revision", 145], ["latest", "Head Revision", 155],
  ["aspectRatio", "Frame", 110],
  ["createdAt", "Created Time", 185], ["createdByUser", "Created by (User)", 205],
  ["updatedAt", "Last Modified Time", 205], ["updatedByUser", "Last Modified by (User)", 220],
] as const;

export const tvPolicyModule: BoModule = {
  label: "Pinoria TV", group: "Pinoria",
  fields: tvPolicyColumns.map(([key, label, w]) => ({
    key, label, w, type: key === "active" || key === "latest" ? "number" : "text",
    icon: "", readonly: true, defaultVisible: true,
  })),
};

export type TvPolicyDirectoryRead =
  | Readonly<{status: "ready"; rows: readonly BoRecord[]; total: number}>
  | Readonly<{status: "unavailable" | "denied"; reason: string; rows: readonly BoRecord[]; total: null}>;

export const tvPolicyUnavailableMessage =
  "Chưa thể tải danh sách chính sách trình chiếu. Nguồn Core chưa được xác minh; số lượng chính sách chưa xác định.";
export const tvPolicyDeniedMessage = "Không có quyền xem danh sách chính sách trình chiếu.";
export const tvPolicyLoginMessage = "Cần đăng nhập Founder để xem danh sách chính sách trình chiếu.";

export function readHoTvPolicyDirectory(): TvPolicyDirectoryRead {
  return { status: "unavailable", reason: "CORE_DIRECTORY_NOT_YET_VERIFIED", rows: [], total: null };
}
const invalid = (): never => { throw new Error("INVALID_CORE_POLICY_DIRECTORY"); };
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
};
const canonical = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const revision = (v: unknown): v is number | null =>
  v === null || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0);

function policyRow(input: unknown): BoRecord {
  const p = record(input);
  if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 200 ||
    p.typeName !== "Ambient Welcome" || p.aspectRatio !== "16:9" ||
    !["PUBLISHED", "INHERITED", "UNCONFIGURED"].includes(String(p.resolution)) ||
    !revision(p.active) || !revision(p.latest) || p.displaysCount !== null ||
    p.createdAt !== null || p.createdByUser !== null ||
    p.updatedAt !== null || p.updatedByUser !== null) return invalid();
  const isDefault = p.scope === "DEFAULT";
  if (isDefault) {
    if (p.id !== "tvp1-default" || p.centerId !== null || p.center !== null ||
      p.inherited !== null || p.resolution === "INHERITED") return invalid();
  } else if (p.scope === "CENTER") {
    if (typeof p.centerId !== "string" || !canonical.test(p.centerId) ||
      p.id !== "tvp1-center-" + p.centerId ||
      typeof p.center !== "string" || !p.center.trim() || p.center.length > 200 ||
      (p.resolution === "INHERITED" ? p.inherited !== "DEFAULT" : p.inherited !== null))
      return invalid();
  } else return invalid();
  if (p.resolution === "UNCONFIGURED" && p.active !== null) return invalid();
  if (p.resolution !== "UNCONFIGURED" && p.active === null) return invalid();
  return {
    id: String(p.id), name: p.name, typeName: p.typeName as string,
    scope: p.scope as string, center: p.center as string | null,
    resolution: p.resolution as string, inherited: p.inherited as string | null,
    active: p.active as number | null, latest: p.latest as number | null,
    displaysCount: null, aspectRatio: "16:9",
    createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null,
  };
}

/** All-or-nothing pagination, no partial Center list or synthetic zero total.
 * Core must independently reauthorize Founder, DEFAULT and every active Center.
 */
export async function loadHoTvPolicyDirectory(
  request: typeof fetch = fetch,
): Promise<TvPolicyDirectoryRead> {
  const rows: BoRecord[] = [];
  const ids = new Set<string>();
  let offset = 0;
  let expectedTotal: number | null = null;
  try {
    for (let page = 0; page < 10; page++) {
      const result = await request(
        "/api/ho/pinoria/tv-policies/directory?limit=50&offset=" + offset,
        { method: "GET", cache: "no-store", credentials: "same-origin" },
      );
      if (result.status === 401 || result.status === 403)
        return {status: "denied", reason: result.status === 401 ? "LOGIN_REQUIRED" : "ACCESS_DENIED", rows: [], total: null};
      if (!result.ok) return invalid();
      const body = record(await result.json());
      const data = record(body.data);
      if (!Array.isArray(data.policies) || !Number.isSafeInteger(data.total) ||
        typeof data.total !== "number" || data.total < 1 || data.total > 500 ||
        data.limit !== 50 || data.offset !== offset || data.policies.length > 50 ||
        (expectedTotal !== null && expectedTotal !== data.total)) return invalid();
      expectedTotal = data.total;
      for (const raw of data.policies) {
        const item = policyRow(raw);
        if (ids.has(item.id)) return invalid();
        ids.add(item.id);
        rows.push(item);
      }
      const next = data.nextOffset;
      if (next === null) {
        if (rows.length !== expectedTotal || !ids.has("tvp1-default")) return invalid();
        return {status: "ready", rows, total: expectedTotal};
      }
      if (!Number.isSafeInteger(next) || typeof next !== "number" ||
        next !== offset + data.policies.length || next <= offset ||
        next >= expectedTotal) return invalid();
      offset = next;
    }
  } catch {
    // Never reveal raw Core errors or incomplete data to the Founder UI.
  }
  return {status: "unavailable", reason: "CORE_DIRECTORY_UNAVAILABLE_OR_INVALID", rows: [], total: null};
}

/** PAP-1419: render-only unknown marker, never mutates or backfills Core nulls.
 * Keep the shared BO/HO Table and its "Trống" default wholly unchanged.
 */
const unverifiedTvColumns = ["displaysCount", "createdAt", "createdByUser", "updatedAt", "updatedByUser"] as const;
export function presentHoTvPolicyRows(rows: readonly BoRecord[]): BoRecord[] {
  return rows.map(row => {
    const presentation = { ...row };
    for (const key of unverifiedTvColumns) {
      if (row[key] === null) presentation[key] = "—";
    }
    return presentation;
  });
}
