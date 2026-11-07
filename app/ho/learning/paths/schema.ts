import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import { adapterError } from "@/lib/workspace-adapters/session";

import type { SurfaceDefinition } from "@/lib/workspace-adapters";
import type { SurfaceProvider, SurfaceScope } from "@/lib/workspace-adapters/contracts";
import { mapHoPaths, type HoPathRow } from "@/lib/ho-paths";

const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
export const pathFields = [
  { key: "name", label: "Tên Path", type: "text", icon: "Aa", width: 250, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "code", label: "Mã Path", type: "text", icon: "#", width: 205, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "group", label: "Nhóm", type: "text", icon: "Aa", width: 115, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "status", label: "Trạng thái", type: "text", icon: "Aa", width: 145, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "createdAt", label: "Created Time", type: "text", icon: "◷", width: 225, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "createdBy", label: "Created by (User)", type: "text", icon: "Aa", width: 220, permission: "bo.operations.view", readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof pathFields;
const columns = ["name", "code", "group", "status", "createdAt", "createdBy"] as const;
const sections = [{ id: "path-info", label: "Thông tin Path", fields: columns }] as const;
const searchable = ["name", "code", "group", "status"] as const;
export const pathQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] },
  sort: { field: "name", direction: "asc" }, group: null,
  order: [...columns], visible: [...columns], page: 1, pageSize: 15,
};
export const pathDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "HO", key: "paths",
  label: "Path", group: "Learning", fields: pathFields,
  capabilities: { read: "bo.operations.view" },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: pathFields.map(f => ({ field: f.key, visible: true })),
    search: { fields: searchable, normalization: "vi-diacritic-insensitive" },
    filters: { fields: searchable, mode: "flat", logic: "AND" },
    sort: { fields: searchable, mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["group", "status"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: { overview: { sections }, businessTabs: [], history: { kind: "unavailable", reason: "Chưa có lịch sử Path được xác minh." } },
} as const satisfies SurfaceDefinition<F>;
async function loadPaths(scope: SurfaceScope, fetcher: typeof fetch, signal: AbortSignal): Promise<HoPathRow[]> {
  if (scope.surface !== "HO") throw adapterError(403);
  // Existing Core-authorized bootstrap. No shadow Path catalog or extra writer.
  const response = await fetcher("/api/ho/learning/paths", { signal, cache: "no-store" });
  if (!response.ok) throw adapterError(response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("data" in body)) throw adapterError(502);
  signal.throwIfAborted();
  return mapHoPaths(body.data);
}
export const pathProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  list: async (_query, scope, fetcher, signal) => {
    const rows = await loadPaths(scope, fetcher, signal);
    return { records: rows.map(row => ({ row })), total: rows.length };
  },
  detail: async (id, scope, fetcher, signal) => {
    const row = (await loadPaths(scope, fetcher, signal)).find(row => row.id === id);
    return row ? { row } : null;
  },
};
const registry = new TddRegistry();
export const pathSchema = registry.register({ ...pathDefinition, data: {
  id: "ho-path-directory",
  list: async (_query, context, signal) => {
    const rows = await loadPaths({ surface: context.surface } as SurfaceScope, fetch, signal);
    return { rows, total: rows.length };
  },
  detail: async (id, context, signal) =>
    (await loadPaths({ surface: context.surface } as SurfaceScope, fetch, signal)).find(row => row.id === id) ?? null,
} });
