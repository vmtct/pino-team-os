// PAP-1407 / PAP-220 — Founder HO Link đăng ký Staff TDD, Center registry projection.
import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { boApi } from "@/lib/bo-api";
import { mapHoCenters } from "@/lib/ho-centers";

const permission = "bo.operations.view";
const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
export const linkFields = [
  { key: "name", label: "Cơ sở", type: "text", icon: "Aa", width: 240, permission, readOnly: true, capabilities: read },
  { key: "centerKey", label: "Mã cơ sở", type: "text", icon: "#", width: 170, permission, readOnly: true, capabilities: read },
  { key: "status", label: "Nhận hồ sơ", type: "text", icon: "◉", width: 160, permission, readOnly: true, capabilities: read },
  { key: "updatedAt", label: "Cập nhật", type: "text", icon: "◷", width: 180, permission, readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof linkFields;
export const linkQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: { field: "name", direction: "asc" },
  group: null, order: ["name", "centerKey", "status", "updatedAt"],
  visible: ["name", "centerKey", "status", "updatedAt"], page: 1, pageSize: 15,
};
const sections = [{ id: "link-state", label: "Liên kết đăng ký", fields: ["name", "centerKey", "status", "updatedAt"] }] as const;
export const linkDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "HO", key: "staffLinks",
  label: "Link đăng ký Staff", group: "Nhân sự", fields: linkFields, capabilities: { read: permission },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: linkFields.map(field => ({ field: field.key, visible: true })),
    search: { fields: ["name", "centerKey", "status"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["name", "centerKey", "status"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "centerKey", "status", "updatedAt"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["status"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: {
    overview: { sections }, businessTabs: [],
    history: { kind: "unavailable", reason: "Lịch sử thay đổi link chưa khả dụng trong giao diện." },
  },
} as const satisfies SurfaceDefinition<F>;
type LinkRow = ModuleRow<F>;
export type FounderStaffLink = {
  centerId: string; token: string; enabled: boolean; version: number; updatedAt: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque = /^[A-Za-z0-9_-]{43}$/;
export async function readFounderStaffLink(
  centerId: string, fetcher: typeof fetch, signal?: AbortSignal,
): Promise<FounderStaffLink> {
  if (!uuid.test(centerId)) throw Error("Cơ sở không hợp lệ.");
  const response = await fetcher("/api/ho/staff-center-links/" + centerId, {
    method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", signal,
  });
  if (!response.ok) throw Error(response.status === 403 ? "Không có quyền xem link." : "Không tải được link đăng ký.");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw Error("Phản hồi link không hợp lệ.");
  const raw: unknown = payload.data;
  if (!raw || typeof raw !== "object") throw Error("Phản hồi link không hợp lệ.");
  const link = raw as Partial<FounderStaffLink>;
  if (link.centerId !== centerId || typeof link.token !== "string" || !opaque.test(link.token)
    || typeof link.enabled !== "boolean" || typeof link.version !== "number"
    || !Number.isSafeInteger(link.version) || link.version < 0
    || !(link.updatedAt === null || typeof link.updatedAt === "string")) throw Error("Phản hồi link không hợp lệ.");
  return { centerId, token: link.token, enabled: link.enabled, version: link.version, updatedAt: link.updatedAt === null ? null : link.updatedAt };
}
function rowFor(id: string, name: string, centerKey: string, link: FounderStaffLink): LinkRow {
  return { id, name, centerKey, status: link.enabled ? "Đang nhận" : "Tạm tắt",
    updatedAt: link.updatedAt ?? "—" };
}
export const linkProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope, fetcher, signal) {
    if (scope.surface !== "HO") throw Error("HO only");
    const centers = mapHoCenters(await boApi.centers(fetcher));
    signal.throwIfAborted();
    // Read every Center independently. Any authorization failure blocks the table;
    // never present missing Center states as a synthetic inactive row.
    const records = await Promise.all(centers.map(async c => ({
      row: rowFor(c.id, c.name, c.centerKey, await readFounderStaffLink(c.id, fetcher, signal)),
    })));
    signal.throwIfAborted();
    return { records, total: records.length };
  },
  async detail(id, scope, fetcher, signal) {
    if (scope.surface !== "HO" || !uuid.test(id)) throw Error("HO Center required");
    const centers = mapHoCenters(await boApi.centers(fetcher));
    signal.throwIfAborted();
    const center = centers.find(c => c.id === id);
    if (!center) return null;
    const link = await readFounderStaffLink(id, fetcher, signal);
    signal.throwIfAborted();
    return { row: rowFor(center.id, center.name, center.centerKey, link) };
  },
};
export const linkSchema = new TddRegistry().register({
  ...linkDefinition,
  data: {
    id: "founder-center-staff-links",
    list: async (_query, context, signal) => {
      const r = await linkProvider.list(linkQuery, { surface: context.surface as "HO" }, fetch, signal);
      return { rows: r.records.map(x => x.row), total: r.total };
    },
    detail: async (id, context, signal) => {
      const r = await linkProvider.detail(id, { surface: context.surface as "HO" }, fetch, signal);
      return r?.row ?? null;
    },
  },
});
