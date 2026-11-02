/** PAP-1073: Node/tsx SSR of the ACTUAL TDD renderer; never a fake shell. */
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { TddTable, TddDrawer, TddDetail } from "../app/components/workspace-renderer";
import { TddRenderer, type TddStage } from "../app/components/workspace-renderer/Renderer";
import { TddRegistry, type AuthorizationContext, type ModuleSchema, type TableQuery, type TddActionDescriptor, type TddActionBindings } from "../lib/workspace-schema";

type Surface = "BO" | "HO";
type Stage = "table" | "drawer" | "detail";
const caps = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;

function fixture(surface: Surface) {
  const fields: ModuleSchema["fields"] = [
    { key: "name", label: "Họ và tên học viên", type: "text", icon: "Aa", width: 225, permission: "fixture.read", readOnly: true, capabilities: caps },
    { key: "id", label: "Mã định danh", type: "id", icon: "#", width: 190, permission: "fixture.read", readOnly: true, capabilities: caps },
    { key: "count", label: "Số lượng", type: "number", icon: "#", width: 130, permission: "fixture.read", readOnly: true, capabilities: caps },
  ];
  const sections = [{ id: "main", label: "Thông tin chính", fields: ["name", "id", "count"] }];
  const registry = new TddRegistry();
  const schema = registry.register({
    version: 1, classification: "TDD_DEFAULT", key: "g3-fixture", label: "Geometry fixture", group: "Tests",
    surface, fields, capabilities: { read: "fixture.read" },
    data: { id: "fixture", list: async () => ({ rows: [], total: 0 }), detail: async () => null },
    table: {
      identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
      columns: fields.map(field => ({ field: field.key, visible: true })),
      search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
      filters: { fields: ["count"], mode: "flat", logic: "AND" },
      sort: { fields: ["count"], mode: "single", nulls: "last", tieBreak: "record-id" },
      group: { fields: ["name"], mode: "single" },
      views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
      pagination: { sizes: [8, 15, 30], defaultSize: 8, mode: "local-ui" },
      inlineEdit: { enabled: false, fields: [] },
      interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
    },
    drawer: { density: "one-column", sections, actions: [] },
    detail: { overview: { sections }, history: { kind: "unavailable", reason: "Chưa có lịch sử khả dụng" }, businessTabs: [
      { id: "relations", label: "Quan hệ", kind: "field-group", source: { adapter: "fixture", permission: "fixture.relations" }, sections },
    ] },
  });
  const context: AuthorizationContext = surface === "BO" ? { surface, centerId: "fixture-center", authorize: () => true } : { surface, authorize: () => true };
  const record = { id: "fixture-001", name: "Học viên kiểm thử giao diện TDD", count: 12 };
  const rows = Array.from({ length: 8 }, (_, n) => ({ id: `fixture-${n + 1}`, name: `Học viên thử nghiệm số ${n + 1}`, count: n + 1 }));
  const query: TableQuery<ModuleSchema["fields"]> = {
    search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null,
    order: ["name", "id", "count"], visible: ["name", "id", "count"], page: 1, pageSize: 8,
  };
  return { schema, registry, context, record, rows, query };
}
function actualMarkup(surface: Surface, stage: Stage) {
  const f = fixture(surface);
  const shared = { schema: f.schema, registry: f.registry, context: f.context };
  if (stage === "table") return renderToStaticMarkup(h(TddTable, { ...shared, query: f.query, rows: f.rows, status: "ready", onQueryChange: () => {}, onOpen: () => {} }));
  if (stage === "drawer") return renderToStaticMarkup(h(TddDrawer, { ...shared, record: f.record, onClose: () => {}, onDetail: () => {} }));
  return renderToStaticMarkup(h(TddDetail, { ...shared, record: f.record, onBack: () => {}, subject: { type: "fixture", id: f.record.id } }));
}
function htmlDocument(surface: Surface, stage: Stage) {
  const cssPath = surface === "BO" ? "public/bo-authority-source/styles.css" : "public/ho-authority-source/ho-scoped.css";
  const styles = readFileSync(resolve(cssPath), "utf8").replaceAll("</style>", "<\\/style>");
  return `<!doctype html><html lang="vi" data-surface="${surface.toLowerCase()}" data-bo-ui-authority="v25"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%}body{min-height:100vh}</style><style>${styles}</style></head><body><main id="g3-fixture" data-surface="${surface.toLowerCase()}" data-bo-ui-authority="v25">${actualMarkup(surface, stage)}</main></body></html>`;
}
const out = resolve("node_modules/.cache/pap1073");
mkdirSync(out, { recursive: true });
for (const surface of ["BO", "HO"] as const) for (const stage of ["table", "drawer", "detail"] as const) {
  const markup = htmlDocument(surface, stage);
  if (!markup.includes(`data-tdd-shell="${stage}"`)) throw Error(`real TDD renderer missing: ${surface} ${stage}`);
  writeFileSync(resolve(out, `${surface}-${stage}.html`), markup, "utf8");
}
process.stdout.write("PAP-1073: 6 real-renderer fixtures generated with checked-in authority CSS.\n");

/** PAP-1247: action-present fixture complements (never replaces) golden no-action fixtures. */
type ActionStage = Stage | "form" | "businessTab";
function actionMarkup(surface: Surface, stage: ActionStage): string {
  const fixtureData = fixture(surface);
  const registry = new TddRegistry();
  const actions = [
    { id: "tableExport", label: "Xuất", slot: "table.header", variant: "secondary", capability: "read", handler: "tableExport" },
    { id: "tableCreate", label: "Tạo mới", slot: "table.header", variant: "primary", capability: "create", handler: "tableCreate" },
    { id: "drawerCopy", label: "Sao chép", slot: "drawer.header", variant: "secondary", capability: "read", handler: "drawerCopy" },
    { id: "drawerEdit", label: "Chỉnh sửa", slot: "drawer.header", variant: "primary", capability: "edit", handler: "drawerEdit" },
    { id: "detailEdit", label: "Chỉnh sửa", slot: "detail.header", variant: "primary", capability: "edit", handler: "detailEdit" },
    { id: "sectionAction", label: "Tải lại", slot: "overview.section", targetId: "main", variant: "secondary", capability: "read", handler: "sectionAction" },
    { id: "tabAction", label: "Xem thêm", slot: "businessTab.toolbar", targetId: "relations", variant: "secondary", capability: "read", handler: "tabAction" },
    { id: "cancel", label: "Hủy", slot: "drawer.footer", formMode: "create", variant: "secondary", capability: "create", handler: "cancel" },
    { id: "save", label: "Tạo", slot: "drawer.footer", formMode: "create", variant: "primary", capability: "create", handler: "save" },
  ] as const satisfies readonly TddActionDescriptor[];
  const schema = registry.register({ ...fixtureData.schema,
    capabilities: { ...fixtureData.schema.capabilities, create: "fixture.create", edit: "fixture.edit" }, actions });
  const context = fixtureData.context;
  const common = { schema, registry, context };
  const bindings: TddActionBindings = Object.fromEntries(actions.map(action =>
    [action.handler, { run: () => undefined }]));
  const render = (view: TddStage<ModuleSchema["fields"]>) =>
    renderToStaticMarkup(h(TddRenderer, { view }));
  if (stage === "table") return render({ kind: "table",
    props: { ...common, rows: fixtureData.rows, query: fixtureData.query, status: "ready",
      onQueryChange: () => {}, onOpen: () => {}, actionBindings: bindings } });
  if (stage === "drawer") return render({ kind: "drawer",
    props: { ...common, record: fixtureData.record, status: "ready",
      onClose: () => {}, onDetail: () => {}, actionBindings: bindings } });
  if (stage === "form") return render({ kind: "form",
    props: { ...common, mode: "create", title: "Tạo mới", content: h("p", null, "Nội dung tạo mẫu"),
      onClose: () => {}, actionBindings: bindings } });
  return render({ kind: "detail",
    props: { ...common, record: fixtureData.record, status: "ready",
      activeTab: stage === "businessTab" ? "relations" : "overview", onBack: () => {},
      subject: { type: "fixture", id: fixtureData.record.id }, actionBindings: bindings } });
}
for (const surface of ["BO", "HO"] as const) {
  const cssPath = surface === "BO" ? "public/bo-authority-source/styles.css" : "public/ho-authority-source/ho-scoped.css";
  const styles = readFileSync(resolve(cssPath), "utf8").replaceAll("</style>", "<\\/style>");
  for (const stage of ["table", "drawer", "detail", "form", "businessTab"] as const) {
    const markup = actionMarkup(surface, stage);
    if (!markup.includes("data-tdd-action-slot=")) throw Error(`PAP-1247 action host missing ${surface} ${stage}`);
    const html = `<!doctype html><html lang="vi" data-surface="${surface.toLowerCase()}" data-bo-ui-authority="v25"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%}body{min-height:100vh}</style><style>${styles}</style></head><body><main id="g3-action-fixture" data-surface="${surface.toLowerCase()}" data-bo-ui-authority="v25">${markup}</main></body></html>`;
    writeFileSync(resolve(out, `${surface}-action-${stage}.html`), html, "utf8");
  }
}
process.stdout.write("PAP-1247: 10 actual shared action-host variants generated (BO/HO x 5 stages).\n");
