import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { TddTable, TddDrawer, TddDetail, TddRenderer } from "../app/components/workspace-renderer";
import { DetailFrame } from "../app/components/workspace-renderer/DetailFrame";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { HistoryState } from "../app/components/workspace-renderer/History";
import { checkedSlotContent } from "../app/components/workspace-renderer/Slots";
import { recordProjection } from "../app/components/workspace-renderer/projection";
import { latestRequest } from "../app/components/workspace-renderer/resource";
import { nextTabIndex, returnToTable } from "../app/components/workspace-renderer/navigation";
import { handleDialogKey } from "../app/components/workspace-renderer/dialog";
import { writeProperty, dispatchCellEdit } from "../app/components/workspace-renderer/editing";
import { BoRegistrationWorkspace } from "../app/bo/components/registration/BoRegistrationWorkspace";
import { HoWorkspace } from "../app/ho/HoWorkspace";
import { registeredTableRows } from "../app/components/workspace-renderer/tableRows";
import { BoTableSettings } from "../app/bo/components/registration/BoTableSettings";
import { BoFullDetail as RegistrationDetail } from "../app/bo/components/registration/BoFullDetail";
import { BoQuickView } from "../app/bo/components/registration/BoQuickView";
import { FIELD_TYPES, TddRegistry, toLegacyModule, toLegacyTableState, type AuthorizationContext, type FieldSchema, type ModuleSchema, type TableQuery } from "./workspace-schema";

const caps = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
/** Test-only modules; no public fixture route, API call, persistence or fake live audit. */
function fixture(surface: "BO" | "HO" = "BO", change: (schema: ModuleSchema) => ModuleSchema = s => s) {
  const fields: ModuleSchema["fields"] = [
    { key: "name", label: "Tên", type: "text", icon: "Aa", width: 225, permission: "fixture.read", readOnly: true, capabilities: caps },
    { key: "id", label: "ID", type: "id", icon: "#", width: 200, permission: "fixture.read", readOnly: true, capabilities: caps },
    { key: "count", label: "Số lượng", type: "number", icon: "#", width: 130, permission: "fixture.read", readOnly: true, capabilities: caps },
  ];
  const sections = [{ id: "main", label: "Thông tin chính", fields: ["name", "id", "count"] }];
  const registry = new TddRegistry();
  const schema = registry.register(change({
    version: 1, classification: "TDD_DEFAULT", key: "test-records", label: "Test records", group: "Tests", surface, fields, capabilities: { read: "fixture.read" },
    data: { id: "fixture", list: async () => ({ rows: [], total: 0 }), detail: async () => null },
    table: {
      identity: { field: "name", pinned: "left", hideable: false, reorderable: false }, columns: fields.map(f => ({ field: f.key, visible: true })),
      search: { fields: ["name"], normalization: "vi-diacritic-insensitive" }, filters: { fields: ["count"], mode: "flat", logic: "AND" },
      sort: { fields: ["count"], mode: "single", nulls: "last", tieBreak: "record-id" }, group: { fields: ["name"], mode: "single" },
      views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
      pagination: { sizes: [8, 15, 30], defaultSize: 8, mode: "local-ui" }, inlineEdit: { enabled: false, fields: [] },
      interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
    }, drawer: { density: "one-column", sections, actions: [] },
    detail: { overview: { sections }, history: { kind: "unavailable", reason: "Chưa có lịch sử khả dụng" }, businessTabs: [
      { id: "relations", label: "Quan hệ", kind: "field-group", source: { adapter: "fixture", permission: "fixture.relations" }, sections },
      { id: "more", label: "Bổ sung", kind: "relation-grid", source: { adapter: "related", permission: "fixture.relations" }, relatedModule: "related" },
    ] },
  }));
  const context: AuthorizationContext = surface === "BO" ? { surface, centerId: "center-a", authorize: () => true } : { surface, authorize: () => true };
  const record = { id: "record-a", name: "Bảo Trân", count: 12 };
  const query: TableQuery<ModuleSchema["fields"]> = { search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null, order: ["name", "id", "count"], visible: ["name", "id", "count"], page: 1, pageSize: 8 };
  return { schema, registry, context, record, query };
}
const html = (node: ReactNode) => renderToStaticMarkup(node);
const noop = () => {};

for (const surface of ["BO", "HO"] as const) {
  test(`${surface}: registered Detail uses one shell with system/business/system order and ARIA`, () => {
    const f = fixture(surface); const out = html(h(TddDetail, { ...f, onBack: noop, subject: { type: "fixture", id: f.record.id } }));
    assert.equal((out.match(/data-tdd-shell="detail"/g) ?? []).length, 1);
    assert.deepEqual([...out.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map(m => m[1]), ["Tổng quan", "Quan hệ", "Bổ sung", "Lịch sử"]);
    assert.match(out, /id="detail-tab-0" aria-selected="true" aria-controls="detail-body" tabindex="0"/);
    assert.match(out, /role="tabpanel" aria-labelledby="detail-tab-0"/); assert.match(out, /Thông tin chính/); assert.match(out, /Chỉ đọc/);
    const business = html(h(TddDetail, { ...f, activeTab: "relations", onBack: noop, subject: { type: "fixture", id: f.record.id } }));
    assert.match(business, /aria-labelledby="detail-tab-1"/); assert.match(business, /data-tdd-properties="detail"/);
    const history = html(h(TddDetail, { ...f, activeTab: "history", onBack: noop, subject: { type: "fixture", id: f.record.id } }));
    assert.match(history, /aria-labelledby="detail-tab-3"/); assert.match(history, /Chưa có lịch sử khả dụng/);
  });
  test(`${surface}: Drawer owns one-column properties, title/footer and Full Detail navigation`, () => {
    const f = fixture(surface); const out = html(h(TddDrawer, { ...f, onClose: noop, onDetail: noop }));
    assert.match(out, /role="dialog" aria-modal="true" aria-labelledby="drawer-title"/);
    assert.match(out, /id="drawer-footer"/); assert.match(out, /id="full-detail"/); assert.match(out, /Thông tin chính/);
    assert.equal((out.match(/class="property-row"/g) ?? []).length, 3);
    assert.doesNotMatch(out, /v24-prop-grid|pencil|data-edit=/);
  });
  test(`${surface}: Table reuses toolbar/settings, registered cells and single typed query`, () => {
    const f = fixture(surface); const rows = [f.record, { id: "record-b", name: "Other", count: 2 }];
    const out = html(h(TddTable, { ...f, rows, status: "ready", onQueryChange: noop, onOpen: noop }));
    assert.equal((out.match(/id="typed-table"/g) ?? []).length, 1);
    for (const id of ["filter-toggle", "visible-columns", "group-shortcut", "search", "page-size"]) assert.ok(out.includes(`id="${id}"`));
    assert.match(out, /class="first-quick-cell"/); assert.match(out, /data-column="name"[^>]*draggable="false"/);
    assert.match(out, /data-sort="name" disabled=""/); assert.match(out, /value="8"/); assert.match(out, /value="15"/); assert.match(out, /value="30"/);
    const filtered = html(h(TddTable, { ...f, query: { ...f.query, search: "bao tran", filters: { logic: "AND", rules: [{ field: "count", op: "gt", value: 10 }] } }, rows, status: "ready", onQueryChange: noop, onOpen: noop }));
    assert.match(filtered, /data-record="record-a"/); assert.doesNotMatch(filtered, /data-record="record-b"/);
    assert.throws(() => html(h(TddTable, { ...f, registry: new TddRegistry(), rows, status: "ready", onQueryChange: noop, onOpen: noop })), /admitted/);
  });
  test(`${surface}: unauthorized fields, tabs and opposite contexts cannot expose data`, () => {
    const f = fixture(surface); const opposite = fixture(surface === "BO" ? "HO" : "BO").context;
    const denied = html(h(TddDetail, { ...f, context: opposite, onBack: noop, subject: { type: "fixture", id: f.record.id } }));
    assert.doesNotMatch(denied, /Bảo|record-a|Số lượng|Quan hệ/);
    assert.match(denied, /Không có quyền/);
    const restricted = { ...f.context, authorize: (p: string) => p === "fixture.read" };
    const out = html(h(TddDetail, { ...f, context: restricted, onBack: noop, subject: { type: "fixture", id: f.record.id } }));
    assert.doesNotMatch(out, /Quan hệ|Bổ sung/); assert.match(out, /Lịch sử/);
    assert.throws(() => html(h(TddDetail, { ...f, onBack: noop, subject: { type: "fixture", id: "foreign" } })), /subject/);
    const p = recordProjection(f.schema, f.context, { ...f.record, rawApiSecret: "never visible" }); assert.ok(p); assert.equal(p.record.rawApiSecret, undefined);
  });
}
test("History exposes truthful empty/denied/unavailable/authorized redacted states", () => {
  assert.match(html(h(HistoryState, { value: { status: "authorized", events: [], nextCursor: null } })), /Chưa có sự kiện/);
  assert.match(html(h(HistoryState, { value: { status: "denied" } })), /Không có quyền/);
  assert.match(html(h(HistoryState, { value: { status: "unavailable", reason: "Chưa có lịch sử khả dụng" } })), /Chưa có lịch sử/);
  const f = fixture("BO", s => ({ ...s, capabilities: { ...s.capabilities, history: "fixture.history" }, detail: { ...s.detail, history: { kind: "provider", source: { adapter: "fixture", permission: "fixture.history" }, load: async () => ({ status: "authorized", events: [], nextCursor: null }) } } }));
  const out = html(h(TddDetail, { ...f, activeTab: "history", onBack: noop, subject: { type: "fixture", id: f.record.id } })); assert.match(out, /Đang tải lịch sử/);
  const deny = html(h(TddDetail, { ...f, context: { ...f.context, authorize: p => p === "fixture.read" }, activeTab: "history", onBack: noop, subject: { type: "fixture", id: f.record.id } })); assert.match(deny, /Không có quyền xem lịch sử/);
});
test("Loading/error/not-found states do not render stale record data", () => {
  const f = fixture();
  for (const status of ["loading", "error", "not-found"] as const) {
    const out = html(h(TddDetail, { ...f, status, onRetry: noop, onBack: noop, subject: { type: "fixture", id: f.record.id } }));
    assert.doesNotMatch(out, /Bảo|record-a/); if (status === "error") assert.match(out, /role="alert".*Thử lại/);
  }
});
test("Business slots cannot mount their own shell, styling or opaque components", () => {
  for (const node of [h("div", { className: "detail-cover" }), h("div", { role: "tablist" }), h("div", { style: { width: 490 } }), h(DetailFrame, { title: "other", children: null }), h("style", null, "body{}")]) assert.throws(() => checkedSlotContent(node));
  assert.doesNotThrow(() => checkedSlotContent(h("section", { className: "v24-prop-section" }, "Approved content")));
  assert.throws(() => fixture("BO", s => ({ ...s, detail: { ...s.detail, businessTabs: [{ ...s.detail.businessTabs[0], kind: "unknown" } as never] } })), /slot/);
  assert.throws(() => fixture("BO", s => ({ ...s, detail: { ...s.detail, businessTabs: [{ ...s.detail.businessTabs[0], id: "overview" }] } })), /reserved/);
});
test("Canonical Table settings keep four categories and protected identity", () => {
  const f = fixture(); const fields = toLegacyModule(f.schema).fields, value = toLegacyTableState(f.schema, f.query, f.context);
  const out = html(h(BoTableSettings, { screen: "home", setScreen: noop, onClose: noop, fields, rows: [f.record], value, update: noop, views: [], setViews: noop, applyView: noop }));
  assert.deepEqual([...out.matchAll(/data-settings="([^"]+)"/g)].map(m => m[1]), ["properties", "group", "filters", "views"]);
});
test("Single sort puts nulls last and uses stable record-ID tie break; grouping/page controls remain shared", () => {
  const f = fixture(); const state = toLegacyTableState(f.schema, f.query, f.context);
  const rows = [{ id: "b", name: "B", count: 2 }, { id: "a", name: "A", count: 2 }, { id: "z", name: "Z", count: null }];
  const policy = { identity: "name", search: ["name"], filter: ["count"], sort: ["count"], group: ["name"], edit: [], viewActions: [] };
  for (const desc of [false, true]) assert.deepEqual(registeredTableRows(rows, toLegacyModule(f.schema).fields, { ...state, sort: "count", desc }, policy).map(r => r.id), ["a", "b", "z"]);
  const server = fixture("BO", s => ({ ...s, table: { ...s.table, pagination: { ...s.table.pagination, mode: "server" } } }));
  const out = html(h(TddTable, { ...server, query: { ...server.query, page: 3 }, rows: [server.record], total: 17, status: "ready", onQueryChange: noop, onOpen: noop }));
  assert.match(out, /17–17 \/ 17/); assert.match(out, /data-record="record-a"/);
});
test("Tab keyboard navigation and return focus preserve actual targets", () => {
  assert.deepEqual(["ArrowLeft", "ArrowRight", "Home", "End", "Tab"].map(k => nextTabIndex(k, 0, 4)), [3, 1, 0, 3, null]);
  const calls: string[] = []; returnToTable(() => calls.push("back"), { isConnected: true, focus: () => calls.push("focus") }); assert.deepEqual(calls, ["back", "focus"]);
  returnToTable(() => {}, { isConnected: false, focus: () => assert.fail("detached focus") });
  const chosen: string[] = [], focused: string[] = [];
  const previous = globalThis.document;
  const previousFrame = globalThis.requestAnimationFrame;
  const back: string[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { getElementById: (id: string) => ({ focus: () => focused.push(id) }) } });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => { callback(0); return 1; } });
  try {
    const tree = DetailFrame({ title: "Fixture", tabs: [{ id: "overview", label: "Tổng quan" }, { id: "history", label: "Lịch sử" }], selected: "overview", onSelect: id => chosen.push(id), children: null,
      onBack: () => back.push("back"), returnFocus: () => ({ isConnected: true, focus: () => back.push("focus") } as unknown as HTMLElement) });
    function walk(node: ReactNode): void {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!isValidElement(node)) return;
      const props = node.props as { role?: string; id?: string; onClick?: () => void; onKeyDown?: (e: { key: string; preventDefault(): void }) => void; children?: ReactNode };
      if (props.id === "back-to-list") props.onClick?.();
      if (props.role === "tab" && props.id === "detail-tab-0") props.onKeyDown?.({ key: "ArrowRight", preventDefault() {} }); else walk(props.children);
    }
    walk(tree); assert.deepEqual(chosen, ["history"]); assert.deepEqual(focused, ["detail-tab-1"]);
    assert.deepEqual(back, ["back", "focus"]);
  } finally { Object.defineProperty(globalThis, "document", { configurable: true, value: previous }); Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: previousFrame }); }
});
test("Drawer key policy traps Tab, Escape and respects an active editor", () => {
  const calls: string[] = []; const first = { focus: () => calls.push("first") }, last = { focus: () => calls.push("last") };
  const event = (key: string, shiftKey = false) => ({ key, shiftKey, preventDefault: () => calls.push("prevent") });
  handleDialogKey(event("Tab"), { first, last, active: last, containsActive: true, editorOpen: false, close: noop });
  handleDialogKey(event("Tab", true), { first, last, active: first, containsActive: true, editorOpen: false, close: noop });
  handleDialogKey(event("Escape"), { active: null, containsActive: true, editorOpen: false, close: () => calls.push("close") });
  assert.deepEqual(calls, ["prevent", "first", "prevent", "last", "prevent", "close"]);
  handleDialogKey(event("Escape"), { active: null, containsActive: true, editorOpen: true, close: () => assert.fail("editor owns Escape") });
});
test("Late history/detail results cannot overwrite another record, and cancellation suppresses failures", async () => {
  const request = latestRequest<string>(); const values: string[] = [], signals: AbortSignal[] = [];
  let first!: (value: string) => void;
  const old = request.run(signal => { signals.push(signal); return new Promise(resolve => { first = resolve; }); }, value => values.push(value), () => assert.fail("stale failure"));
  await request.run(async signal => { signals.push(signal); return "record-b"; }, value => values.push(value), () => assert.fail());
  first("record-a"); await old; assert.deepEqual(values, ["record-b"]); assert.equal(signals[0].aborted, true);
  let reject!: (error: Error) => void; const pending = request.run(() => new Promise((_r, fail) => { reject = fail; }), () => assert.fail(), () => assert.fail()); request.cancel(); reject(Error("aborted")); await pending;
});
test("Both legacy Detail entrypoints delegate shell ownership and retain old tab/navigation profiles", () => {
  const f = fixture(); const definition = toLegacyModule(f.schema);
  const registration = html(h(RegistrationDetail, { module: definition, moduleKey: "students", record: f.record, mobileMenu: null, onBack: noop, enableStudentSubscriptions: true }));
  assert.match(registration, /Thông tin/); assert.match(registration, /Subscription/); assert.match(registration, /Lịch Sử/);
  assert.equal((registration.match(/data-tdd-shell="detail"/g) ?? []).length, 1);
  const require = createRequire(import.meta.url), prior = require.extensions[".css"];
  require.extensions[".css"] = loaded => { loaded.exports = {}; };
  try {
    const { BoFullDetail } = require("../app/bo/components/BoFullDetail") as typeof import("../app/bo/components/BoFullDetail");
    const factory = html(h(BoFullDetail, { title: "Factory record", currentUrl: "/bo/learners?id=a", returnTo: "/bo/learners", tabs: [{ id: "detail", label: "Detail", content: "Properties" }, { id: "specialized", label: "Chuyên Sâu", content: "Business" }, { id: "history", label: "Lịch Sử", content: "History" }], designVariant: "v25" }));
    assert.match(factory, /data-tdd-shell="detail"/); assert.match(factory, /href="\/bo\/learners"/); assert.match(factory, /Properties/);
    const { BoModuleFactory } = require("../app/bo/architecture/BoModuleFactory") as typeof import("../app/bo/architecture/BoModuleFactory");
    const adopted = html(h(BoModuleFactory, { moduleKey: f.schema.key, adapter: { list: async () => { throw Error("legacy adapter must not load"); } }, tdd: { kind: "detail", props: { ...f, onBack: noop, subject: { type: "fixture", id: f.record.id } } } }));
    assert.match(adopted, /Tổng quan/); assert.match(adopted, /Lịch sử/); assert.equal((adopted.match(/data-tdd-shell="detail"/g) ?? []).length, 1);
  } finally { if (prior) require.extensions[".css"] = prior; else delete require.extensions[".css"]; }
});
test("Parent Drawer cannot use the cramped full-detail grid, and both authorities retain canonical geometry", () => {
  const f = fixture(); const out = html(h(BoQuickView, { module: toLegacyModule(f.schema), moduleKey: "parents", record: f.record, onClose: noop, onDetail: noop }));
  assert.doesNotMatch(out, /v24-prop-grid/); assert.match(out, /data-tdd-properties="drawer"/);
  const geometry = readFileSync("public/bo-authority-source/styles.css", "utf8");
  const css = postcss.parse(geometry);
  const propertyAt = (selector: string, property: string, width: number) => {
    let value = "";
    css.walkRules(rule => {
      if (rule.selector !== selector) return;
      for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
        if (parent.type === "atrule" && parent.name === "media") { const max = parent.params.match(/max-width:\s*(\d+)px/); if (max && width > Number(max[1])) return; }
      }
      rule.walkDecls(property, declaration => { value = declaration.value; });
    }); return value;
  };
  const drawerWidth = Number(geometry.match(/--bo-drawer-width:\s*(\d+)px/)![1]);
  const valueWidths: number[] = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    const props = html(h(PropertySections, { variant: "drawer", fields: toLegacyModule(f.schema).fields, record: f.record, sections: f.schema.drawer.sections }));
    assert.doesNotMatch(props, /v24-prop-grid/, String(width));
    const label = Number(propertyAt(".property-row", "grid-template-columns", width).match(/^(\d+)px/)![1]);
    const padding = Number.parseInt(propertyAt(".drawer-content", "padding", width));
    const gap = Number.parseInt(propertyAt(".property-row", "gap", width));
    valueWidths.push(Math.min(width, drawerWidth) - 2 * padding - label - gap);
  }
  assert.deepEqual(valueWidths, [170, 240, 300, 300, 300], "Derived DS tracks, not measured browser geometry");
  assert.ok(valueWidths.every(width => width > 92), "One-column values must exceed the old compressed 92px track");
  assert.match(geometry, /\.property-row\s*\{[^}]*grid-template-columns:\s*130px minmax\(0,\s*1fr\)/);
  assert.match(geometry, /\.quick-open-th[^}]*width:\s*37px/);
  const factory = readFileSync("app/bo/components/BoFullDetail.tsx", "utf8"), legacy = readFileSync("app/bo/components/registration/BoFullDetail.tsx", "utf8");
  assert.match(factory, /<DetailFrame/); assert.match(legacy, /<DetailFrame/);
  assert.doesNotMatch(factory + legacy, /className="detail-cover"|className="detail-hero"/);
});

test("Readonly, missing grants and revoked grants never dispatch an inline mutation", async () => {
  const f = fixture(); let calls = 0;
  const adapter = { update: async () => { calls++; return { status: "saved" as const, row: f.record, version: "2" }; } };
  assert.equal(dispatchCellEdit(f.schema, f.context, "count", () => calls++), false);
  await assert.rejects(writeProperty(f.schema, f.context, f.record, "count", 7, "1", adapter, new AbortController().signal), /unauthorized/); assert.equal(calls, 0);
  const editable = fixture("BO", s => ({ ...s, capabilities: { ...s.capabilities, edit: "fixture.edit" }, fields: s.fields.map(field => field.key === "count" && field.type === "number" ? { ...field, readOnly: false, capabilities: { ...field.capabilities, inlineEdit: true } } : field), table: { ...s.table, inlineEdit: { enabled: true, fields: ["count"] } } }));
  let permitted = true;
  const context = { ...editable.context, authorize: (key: string) => key !== "fixture.edit" || permitted };
  assert.equal(dispatchCellEdit(editable.schema, context, "count", () => calls++), true);
  permitted = false; assert.equal(dispatchCellEdit(editable.schema, context, "count", () => calls++), false);
  await assert.rejects(writeProperty(editable.schema, context, editable.record, "count", 7, "1", adapter, new AbortController().signal)); assert.equal(calls, 1);
  const out = html(h(TddDrawer, { ...f, onClose: noop, onDetail: noop, writes: { adapter, version: "1", onSaved: () => assert.fail("readonly saved") } }));
  assert.doesNotMatch(out, /pencil|edit-save/);
});
test("Authenticated writes preserve version/identity and reject late permission changes", async () => {
  const f = fixture("BO", s => ({ ...s, capabilities: { ...s.capabilities, edit: "fixture.edit" }, fields: s.fields.map(field => field.key === "count" && field.type === "number" ? { ...field, readOnly: false, capabilities: { ...field.capabilities, inlineEdit: true } } : field) }));
  let called = 0;
  const result = await writeProperty(f.schema, f.context, f.record, "count", 7, "1", { update: async (id, patch, version, context, signal) => { called++; assert.equal(id, f.record.id); assert.deepEqual(patch, { count: 7 }); assert.equal(version, "1"); assert.equal(context, f.context); assert.equal(signal.aborted, false); return { status: "saved", row: { ...f.record, count: 7 }, version: "2" }; } }, new AbortController().signal);
  assert.equal(result.status, "saved"); assert.equal(called, 1);
  await assert.rejects(writeProperty(f.schema, f.context, f.record, "count", 7, "1", { update: async () => ({ status: "saved", row: { ...f.record, id: "foreign" }, version: "2" }) }, new AbortController().signal), /identity/);
  let permitted = true; const context = { ...f.context, authorize: () => permitted };
  await assert.rejects(writeProperty(f.schema, context, f.record, "count", 7, "1", { update: async () => { permitted = false; return { status: "saved", row: f.record, version: "2" }; } }, new AbortController().signal), /permission changed/);
});
test("Existing BO/HO workspace hosts can opt in without changing default journeys", () => {
  const f = fixture(); const view = { kind: "table" as const, props: { ...f, rows: [f.record], status: "ready" as const, onQueryChange: noop, onOpen: noop } };
  const source = { modules: { [f.schema.key]: toLegacyModule(f.schema) }, load: async () => { throw Error("legacy load must not run"); }, scopeLabel: () => "", readOnly: true };
  const bo = html(h(BoRegistrationWorkspace, { currentUser: { displayName: null }, moduleKey: f.schema.key, source, tdd: view }));
  assert.equal((bo.match(/id="typed-table"/g) ?? []).length, 1); assert.match(bo, /data-tdd-shell="table"/);
  assert.throws(() => html(h(BoRegistrationWorkspace, { currentUser: { displayName: null }, moduleKey: "other", source, tdd: view })), /mismatch/);
  const editable = fixture("BO", s => ({ ...s, capabilities: { ...s.capabilities, edit: "fixture.edit" } }));
  assert.throws(() => html(h(BoRegistrationWorkspace, { currentUser: { displayName: null }, moduleKey: f.schema.key, source, tdd: { kind: "detail", props: { ...editable, onBack: noop, subject: { type: "fixture", id: f.record.id } } } })), /Read-only workspace/);
  const ho = fixture("HO", s => ({ ...s, key: "centers" }));
  const out = html(h(HoWorkspace, { module: "centers", tdd: { kind: "detail", props: { ...ho, onBack: noop, subject: { type: "center", id: ho.record.id } } } }));
  assert.match(out, /Tổng quan/); assert.match(out, /Lịch sử/); assert.equal((out.match(/data-tdd-shell="detail"/g) ?? []).length, 1);
  assert.throws(() => html(h(TddRenderer, { view: { ...view, props: { ...view.props, registry: new TddRegistry() } } })), /admitted/);
});
test("All 16 registered field primitives render through existing typed Table and Drawer values", () => {
  const f = fixture("BO", source => {
    const fields = FIELD_TYPES.map(type => ({ key: type === "text" ? "name" : type, type, label: type, icon: "Aa", width: 150, permission: "fixture.read", readOnly: true, capabilities: caps } as FieldSchema));
    const sections = [{ id: "all", label: "All fields", fields: fields.map(field => field.key) }];
    return { ...source, fields, table: { ...source.table, columns: fields.map(field => ({ field: field.key, visible: true })), filters: { fields: ["number"], mode: "flat", logic: "AND" }, sort: { ...source.table.sort, fields: ["number"] } }, drawer: { ...source.drawer, sections }, detail: { overview: { sections }, history: source.detail.history, businessTabs: [] } };
  });
  const record = { id: "all-types", name: "All fields", select: "Active", number: 2, currency: 3000, date: "2026-10-28", relation: "Relation", boolean: false, textarea: "Long text", datetime: "2026-10-28T10:00:00+07:00", multirelation: ["A", "B"], person: "Person", multiselect: ["Tag"], email: "example@example.test", url: "https://example.test", formula: 5 };
  const drawer = html(h(TddDrawer, { ...f, record, onClose: noop, onDetail: noop }));
  assert.equal((drawer.match(/class="property-row"/g) ?? []).length, 16);
  const query = { ...f.query, order: f.schema.table.columns.map(c => c.field), visible: f.schema.table.columns.map(c => c.field) };
  const table = html(h(TddTable, { ...f, query, rows: [record], status: "ready", onQueryChange: noop, onOpen: noop }));
  assert.equal((table.match(/data-column=/g) ?? []).length, 16);
});
test("Drawer stage preserves its same-scope Table background and rejects another scope", () => {
  const f = fixture();
  const table = { ...f, rows: [f.record], status: "ready" as const, onQueryChange: noop, onOpen: noop };
  const props = { ...f, onClose: noop, onDetail: noop };
  const out = html(h(TddRenderer, { view: { kind: "drawer", props, table } }));
  assert.equal((out.match(/id="typed-table"/g) ?? []).length, 1); assert.equal((out.match(/data-tdd-shell="drawer"/g) ?? []).length, 1);
  assert.throws(() => html(h(TddRenderer, { view: { kind: "drawer", props, table: { ...table, context: { surface: "BO", centerId: "other", authorize: () => true } } } })), /scope mismatch/);
});
