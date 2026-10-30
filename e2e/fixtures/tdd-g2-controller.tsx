import { createRoot } from "react-dom/client";
import { SurfaceWorkspace } from "../../app/components/workspace-adapters/SurfaceWorkspace";
import { TddRegistry, type AuthorizationContext, type FieldSchema, type TableQuery } from "../../lib/workspace-schema";
import type { AuthenticatedSurfaceAdapter, SurfaceDefinition } from "../../lib/workspace-adapters";
import { browserTddNavigation } from "../../lib/workspace-adapters/navigation";
import { BoApiError } from "../../lib/bo-api-error";

// Synthetic module integration only: no public route, live auth, API or DS fork.
declare global { interface Window { __g2ReleaseOld?: () => void; __g2OldResolved?: boolean } }
const surface = location.hostname.startsWith("ho.") ? "HO" : "BO";
const key = surface === "BO" ? "parents" : "centers";
const scenario = new URL(location.href).searchParams.get("scenario");
const caps = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const display = { ...caps, search: false, filter: false, sort: false, group: false };
const fields = [
  { key: "name", label: "Tên", type: "text", icon: "Aa", width: 225, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "id", label: "ID", type: "id", icon: "#", width: 190, permission: "fixture.read", readOnly: true, capabilities: display },
  { key: "count", label: "Số lượng", type: "number", icon: "#", width: 130, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "secret", label: "Restricted", type: "text", icon: "Aa", width: 150, permission: "fixture.secret", readOnly: true, sensitive: true, capabilities: display },
] as const satisfies readonly FieldSchema[];
type Fields = typeof fields;
const sections = [{ id: "main", label: "Thông tin chính", fields: ["name", "id", "count", "secret"] as const }];
const query: TableQuery<Fields> = { search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null, order: ["name", "id", "count"], visible: ["name", "count"], page: 1, pageSize: 8 };
const definition: SurfaceDefinition<Fields> = {
  version: 1, classification: "TDD_DEFAULT", surface, key, label: "G2 module fixture", group: "Tests", fields,
  capabilities: { read: "fixture.read", history: "fixture.audit" },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false }, columns: fields.filter(f => f.key !== "secret").map(f => ({ field: f.key, visible: f.key === "name" || f.key === "count" })),
    search: { fields: ["name"], normalization: "vi-diacritic-insensitive" }, filters: { fields: ["count"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "count"], mode: "single", nulls: "last", tieBreak: "record-id" }, group: { fields: ["name"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] }, pagination: { sizes: [8, 15, 30], defaultSize: 8, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false }, interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: { overview: { sections }, history: scenario === "history-denied" ? { kind: "provider", source: { adapter: "fixture-audit", permission: "fixture.audit" }, load: async () => ({ status: "denied" as const }) } : { kind: "unavailable", reason: "Chưa có lịch sử khả dụng" }, businessTabs: [
    { id: "relations", label: "Quan hệ", kind: "field-group", source: { adapter: "fixture-relations", permission: "fixture.relations" }, sections },
  ] },
};
const rows = Array.from({ length: 32 }, (_, index) => ({ id: `019d2000-0002-7000-8000-${String(index + 1).padStart(12, "0")}`, name: `Fixture ${String(index + 1).padStart(2, "0")}`, count: index + 1, secret: "PRIVATE_MUST_NOT_RENDER" }));
const authorize = (permission: string) => scenario !== "denied" && permission !== "fixture.secret" && !(scenario === "business-denied" && permission === "fixture.relations") && !(scenario === "history-denied" && permission === "fixture.audit");
const contextSurface = scenario === "cross-surface" ? surface === "BO" ? "HO" : "BO" : surface;
const context: AuthorizationContext = contextSurface === "BO" ? { surface: "BO", centerId: "fixture-center", authorize } : { surface: "HO", authorize };
const registry = new TddRegistry();
const schema = registry.register({ ...definition, data: { id: "g2-fixture", list: async () => ({ rows, total: rows.length }), detail: async id => rows.find(r => r.id === id) ?? null } });
let listCalls = 0, detailCalls = 0;
const adapter: AuthenticatedSurfaceAdapter<Fields> = {
  registry, schema, context, scope: surface === "BO" ? { surface, centerId: "fixture-center" } : { surface }, userId: "fixture-actor",
  capabilities: { read: scenario !== "denied", edit: false, create: false, delete: false, reveal: false, audit: scenario !== "history-denied" },
  list: async () => { await new Promise(r => setTimeout(r, 80)); if (scenario === "list-error" && listCalls++ === 0) throw new BoApiError(503, "Fixture read failed", null); return { rows, total: rows.length, versions: {} }; },
  detail: async id => {
    if (scenario === "detail-error" && detailCalls++ === 0) throw new BoApiError(503, "Fixture detail failed", null);
    if (scenario === "stale" && id === rows[0].id) return new Promise(resolve => { window.__g2ReleaseOld = () => { resolve({ row: rows[0] }); window.__g2OldResolved = true; }; });
    return { row: rows.find(r => r.id === id)! };
  },
  views: async () => ({ unavailable: [] }), subject: id => ({ type: "fixture", id }), history: async () => ({ status: "denied" }), dispose() {},
};
createRoot(document.getElementById("root")!).render(<SurfaceWorkspace adapter={adapter} navigation={browserTddNavigation(surface, key, query)} initialQuery={query} />);
