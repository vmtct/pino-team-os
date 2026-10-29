import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { TddTable, TddDrawer, TddDetail, TddRenderer } from "../app/components/workspace-renderer";
import { projectSavedViews, mergeSavedViews, type SavedTddView } from "../app/components/workspace-renderer/Table";
import { DetailFrame } from "../app/components/workspace-renderer/DetailFrame";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { HistoryState } from "../app/components/workspace-renderer/History";
import { checkedSlotContent, resolveBusinessFormProvider, validateBusinessFormData, validateBusinessFormSubmitResult, type BusinessFormBinding, type BusinessFormProvider } from "../app/components/workspace-renderer/Slots";
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
import { FIELD_TYPES, TddRegistry, toLegacyModule, toLegacyTableState, validateQuery, type AuthorizationContext, type FieldSchema, type ModuleSchema, type TableQuery } from "./workspace-schema";

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
  test(`${surface}: incompatible authorized Saved Views do not crash or hide usable Table views and rows`, () => {
    const f = fixture(surface, s => ({ ...s, fields: [...s.fields, { key: "tags", type: "multiselect", label: "Tags", icon: "#", width: 160, permission: "fixture.read", readOnly: true, capabilities: caps }], table: { ...s.table, filters: { ...s.table.filters, fields: ["count", "tags"] }, views: { ...s.table.views, saved: { kind: "authorized-service", source: { adapter: "views", permission: "fixture.views" }, scopes: ["personal"], conflict: "version" } } } }));
    const bad: SavedTddView<ModuleSchema["fields"]> = { id: "incompatible", name: "Comma view", version: "bad-v1", state: { ...f.query, filters: { logic: "AND", rules: [{ field: "tags", op: "any", value: ["VIP,Gold", "Other"] }] } } };
    const good: SavedTddView<ModuleSchema["fields"]> = { id: "valid", name: "Normal view", version: "good-v1", state: { ...f.query, filters: { logic: "AND", rules: [{ field: "count", op: "gte", value: 2 }] } } };
    const source = [bad, good]; const before = JSON.stringify(source);
    const transport = { views: source, write: async () => { assert.fail("render must never write views"); return source; } };
    const table = (context = f.context) => html(h(TddTable, { ...f, context, rows: [f.record], status: "ready", viewTransport: transport, onQueryChange: noop, onOpen: noop }));
    const out = table();
    assert.match(out, /data-record="record-a"/); assert.match(out, /Bảo Trân/);
    assert.match(out, /data-saved="valid"/); assert.doesNotMatch(out, /data-saved="incompatible"/);
    assert.match(out, /Comma view — Không khả dụng/); assert.match(out, /Xóa Quick View không khả dụng Comma view/);
    assert.match(out, /dữ liệu đã lưu được giữ nguyên/); assert.doesNotMatch(out, /VIP,Gold/);
    const remote = projectSavedViews(f.schema, f.context, source);
    assert.equal(remote.available.length, 1); assert.equal(remote.unavailable[0], bad);
    const renamed = mergeSavedViews(f.schema, f.context, source, remote.available, remote.available.map(v => ({ ...v, name: "Renamed" })));
    assert.equal(renamed[0], bad); assert.equal(renamed[1].state, good.state); assert.equal(renamed[1].version, "good-v1"); assert.equal(renamed[1].name, "Renamed");
    assert.deepEqual(mergeSavedViews(f.schema, f.context, source, remote.available, []), [bad]);
    assert.throws(() => mergeSavedViews(f.schema, { ...f.context, authorize: () => false }, source, remote.available, remote.available), /permission|unauthorized|denied/);
    assert.equal(JSON.stringify(source), before); assert.throws(() => toLegacyTableState(f.schema, bad.state, f.context), /unrepresentable/);
    assert.doesNotMatch(table({ ...f.context, authorize: p => p !== "fixture.views" }), /Comma view|Normal view|Xóa Quick View/);
    // The same normal remote view also works without an incompatible neighbor.
    assert.match(html(h(TddTable, { ...f, rows: [f.record], status: "ready", viewTransport: { ...transport, views: [good] }, onQueryChange: noop, onOpen: noop })), /data-saved="valid"/);
  });
  test(`${surface}: unavailable Saved View removal obeys configured action and shared-view grants`, () => {
    for (const shared of [false, true]) {
      const f = fixture(surface, s => ({ ...s, capabilities: { ...s.capabilities, manageSharedViews: "fixture.manage-views" }, table: { ...s.table, views: { ...s.table.views, actions: shared ? s.table.views.actions : ["apply"], saved: { kind: "authorized-service", source: { adapter: "views", permission: "fixture.views" }, scopes: shared ? ["shared"] : ["personal"], conflict: "version" } } } }));
      const out = html(h(TddTable, { ...f, context: { ...f.context, authorize: p => p !== "fixture.manage-views" }, rows: [f.record], status: "ready", viewTransport: { views: [{ id: "unavailable", name: "Unavailable view", version: "1", state: { ...f.query, visible: [] } }], write: async () => assert.fail("no unauthorized write") }, onQueryChange: noop, onOpen: noop }));
      assert.match(out, /Unavailable view — Không khả dụng/); assert.doesNotMatch(out, /aria-label="Xóa Quick View/);
    }
  });
  test(`${surface}: nullable names render empty cells and neutral Drawer/Detail identities`, () => {
    const f = fixture(surface);
    for (const name of [null, undefined]) {
      const record = { ...f.record, name };
      const projected = recordProjection(f.schema, f.context, record)!;
      assert.equal(projected.title, "—"); assert.equal(projected.record.name, ""); assert.equal(record.name, name);
      const table = html(h(TddTable, { ...f, rows: [record], status: "ready", onQueryChange: noop, onOpen: noop }));
      assert.match(table, /data-record="record-a"/); assert.match(table, /class="empty-val">Trống/);
      const drawer = html(h(TddDrawer, { ...f, record, onClose: noop, onDetail: noop })); assert.match(drawer, /id="drawer-title"[^>]*>—/);
      const detail = html(h(TddDetail, { ...f, record, onBack: noop, subject: { type: "fixture", id: record.id } })); assert.match(detail, /id="detail-title">—/);
      for (const out of [table, drawer, detail]) assert.doesNotMatch(out, />null<|>undefined<|Bảo Trân/);
    }
  });
  test(`${surface}: all typed identities and nullable identity values render with an absent name`, () => {
    const values = { text: "Identity", id: "identity-a", select: "Active", number: 0, currency: 3000, date: "2026-10-28", relation: "Relation", boolean: false, textarea: "Long text", datetime: "2026-10-28T10:00:00+07:00", multirelation: ["A", "B"], person: "Person", multiselect: ["Tag"], email: "example@example.test", url: "https://example.test", formula: 5 };
    for (const type of FIELD_TYPES) {
      const f = fixture(surface, s => ({ ...s, fields: [...s.fields, { key: "identity", type, label: "Identity", icon: "#", width: 160, permission: "fixture.read", readOnly: true, capabilities: caps } as FieldSchema], table: { ...s.table, identity: { ...s.table.identity, field: "identity" }, columns: [{ field: "identity", visible: true }, ...s.table.columns] } }));
      const query = { ...f.query, order: ["identity", ...f.query.order], visible: ["identity", ...f.query.visible] };
      for (const identity of [values[type], null, undefined]) {
        const record = { ...f.record, name: null, identity };
        assert.equal(recordProjection(f.schema, f.context, record)!.title, identity == null ? "—" : String(identity));
        for (const node of [h(TddTable, { ...f, query, rows: [record], status: "ready", onQueryChange: noop, onOpen: noop }), h(TddDrawer, { ...f, record, onClose: noop, onDetail: noop }), h(TddDetail, { ...f, record, onBack: noop, subject: { type: "fixture", id: record.id } })]) assert.doesNotThrow(() => html(node));
      }
      const denied = { ...f.context, authorize: () => false };
      assert.equal(recordProjection(f.schema, denied, { ...f.record, identity: values[type] }), null);
    }
  });
}

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
test("Authorized history reuses approved audit rows, field labels and Vietnamese outcomes", () => {
  const out = html(h(HistoryState, { fields: [{ key: "count", label: "Số lượng" }], value: { status: "authorized", nextCursor: "next", events: [{ id: "event", at: "2026-10-28T00:00:00Z", actor: "Tác nhân đã che", source: "Core", action: "record.updated", outcome: "succeeded", redacted: true, subject: { type: "fixture", id: "record" }, changes: [{ field: "count", before: 1, after: 2 }] }] }, onNext: noop }));
  for (const name of ["v25-audit-list", "v25-audit-row", "v25-audit-when", "v25-audit-who", "v25-audit-action", "v25-audit-changes", "v25-change-flow", "v25-audit-outcome"]) assert.ok(out.includes(name));
  assert.match(out, /Số lượng/); assert.match(out, /Thành công/); assert.match(out, /07:00/); assert.match(out, /Trang lịch sử tiếp/);
  assert.doesNotMatch(out, /record.updated|<ol|style=/);
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
for (const surface of ["BO", "HO"] as const) test(`${surface}: business forms resolve only one exact registered provider and do not need generic edit`, () => {
  const f = fixture(surface, schema => ({ ...schema, detail: { ...schema.detail, businessTabs: [{ id: "rate", label: "Rate", kind: "form", fields: ["count"], source: { adapter: "salary.rate", permission: "rate.read" }, submitPermission: "rate.submit" }] } }));
  const slot = f.schema.detail.businessTabs[0];
  assert.equal(f.schema.capabilities.edit, undefined);
  const provider: BusinessFormProvider = { surface, moduleKey: f.schema.key, slotId: slot.id, sourceAdapter: slot.source.adapter, load: async () => ({ status: "denied" }), submit: async () => ({ status: "denied" }) };
  const binding: BusinessFormBinding = { providers: [provider], principalId: "user-a", subject: { type: "staff", id: f.record.id } };
  assert.equal(resolveBusinessFormProvider(f.schema, slot, binding), provider);
  assert.equal(resolveBusinessFormProvider(f.schema, slot, { ...binding, providers: [provider, provider] }), null, "ambiguous registration fails closed");
  assert.equal(resolveBusinessFormProvider(f.schema, slot, { ...binding, providers: [{ ...provider, sourceAdapter: "wrong" }] }), null);
  assert.equal(resolveBusinessFormProvider(f.schema, slot, { ...binding, providers: [{ ...provider, moduleKey: "wrong" }] }), null);
  assert.equal(resolveBusinessFormProvider(f.schema, slot, { ...binding, providers: [{ ...provider, surface: surface === "BO" ? "HO" : "BO" }] }), null);
  assert.equal(resolveBusinessFormProvider(f.schema, slot, { ...binding, subject: { type: "staff", id: "" } }), null);
  const missing = html(h(TddDetail, { ...f, activeTab: "rate", onBack: noop, subject: { type: "staff", id: f.record.id } }));
  assert.match(missing, /Biểu mẫu chưa khả dụng/); assert.doesNotMatch(missing, /<form/);
});
test("business form payloads are typed, non-opaque and history rows require stable identities", () => {
  const data = { status: "authorized", fields: [
    { key: "amount", label: "Amount", type: "number", required: true }, { key: "effectiveDate", label: "Effective date", type: "date", required: true }, { key: "reason", label: "Reason", type: "textarea", required: true },
  ], values: { amount: 120000, effectiveDate: "2026-10-28", reason: "Adjustment" }, records: { label: "History", columns: [
    { key: "amount", label: "Amount", type: "number" }, { key: "effectiveDate", label: "Date", type: "date" }, { key: "reason", label: "Reason", type: "text" }, { key: "actor", label: "Actor", type: "text" },
  ], rows: [{ id: "rate-1", values: { amount: 100000, effectiveDate: "2026-01-01", reason: "Initial", actor: "Authorized actor" } }] } } as const;
  assert.equal(validateBusinessFormData(data), data);
  assert.equal(validateBusinessFormData(data, ["amount", "effectiveDate", "reason"]), data);
  assert.throws(() => validateBusinessFormData(data, ["amount", "effectiveDate"]), /allowlist/);
  assert.throws(() => validateBusinessFormData({ ...data, values: { ...data.values, effectiveDate: "2026-02-30" } }), /field value/);
  assert.throws(() => validateBusinessFormData({ ...data, fields: [...data.fields, { key: "unsafe", label: "Unsafe", type: "component" as never }] }), /field/);
  assert.throws(() => validateBusinessFormData({ ...data, values: { ...data.values, secret: "leak" } }), /unregistered/);
  assert.throws(() => validateBusinessFormData({ ...data, records: { ...data.records, rows: [{ id: "", values: data.records.rows[0].values }] } }), /record/);
  assert.throws(() => validateBusinessFormData({ status: "denied", fields: data.fields } as never), /denied payload/);
  assert.deepEqual(validateBusinessFormSubmitResult({ status: "saved" }, data.fields), { status: "saved" });
  assert.throws(() => validateBusinessFormSubmitResult({ status: "invalid", fields: ["secret"] }, data.fields), /submit fields/);
  assert.throws(() => validateBusinessFormSubmitResult({ status: "denied", fields: [] } as never, data.fields), /denied submit/);
});
test("business form load and submit requests are latest-only and abort independently", async () => {
  const load = latestRequest<string>(), submit = latestRequest<string>(); const signals: AbortSignal[] = [], committed: string[] = [];
  let oldLoad!: (value: string) => void, oldSubmit!: (value: string) => void;
  const firstLoad = load.run(signal => { signals.push(signal); return new Promise(resolve => { oldLoad = resolve; }); }, value => committed.push(value), () => assert.fail());
  const firstSubmit = submit.run(signal => { signals.push(signal); return new Promise(resolve => { oldSubmit = resolve; }); }, value => committed.push(value), () => assert.fail());
  await load.run(async signal => { signals.push(signal); return "record-b"; }, value => committed.push(value), () => assert.fail());
  submit.cancel(); oldLoad("record-a"); oldSubmit("saved-a"); await Promise.all([firstLoad, firstSubmit]);
  assert.deepEqual(committed, ["record-b"]); assert.equal(signals[0].aborted, true); assert.equal(signals[1].aborted, true);
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


/** PAP-1072 G2: deterministic semantic controls, not a browser/visual G3 claim. */
test("G2: legacy Details keep every tab aria-controls attached to the one mounted panel", () => {
  const tabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "relations", label: "Quan hệ" },
    { id: "history", label: "Lịch sử" },
  ];
  for (const selected of tabs.map(t => t.id)) {
    const out = html(h(DetailFrame, {
      title: "Legacy Parent", tabs, selected, onSelect: noop, children: "Authorized content",
      legacyProfile: { version: "v25", tabs: "bo-detail-tabs", body: "bo-detail-body", panel: "bo-detail-panel" },
    }));
    const panel = `bo-detail-panel-${selected}`;
    const ids = new Set([...out.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    const controls = [...out.matchAll(/aria-controls="([^"]+)"/g)].map(m => m[1]);
    assert.equal(controls.length, tabs.length, "each tab must control the mounted panel");
    assert.deepEqual(controls, tabs.map(() => panel), "inactive tabs cannot point to unmounted panels");
    assert.ok(ids.has(panel), "tabpanel target must exist in the same DOM tree");
    assert.match(out, new RegExp(`role="tabpanel" aria-labelledby="bo-detail-tab-${selected}"`));
    assert.equal((out.match(/aria-selected="true"/g) ?? []).length, 1, "one selected tab");
    assert.equal((out.match(/tabindex="0"/g) ?? []).length, 2, "one roving tab and focusable panel");
  }
});

for (const surface of ["BO", "HO"] as const) {
  test(`G2 ${surface}: three business variants retain one system shell, ordered tabs and valid ARIA references`, () => {
    const f = fixture(surface, s => ({
      ...s, key: surface === "BO" ? "parents-pilot" : "centers-pilot",
      detail: { ...s.detail, businessTabs: [...s.detail.businessTabs,
        { id: "enrollments", label: surface === "BO" ? "Đăng ký" : "Địa điểm", kind: "relation-grid" as const,
          source: { adapter: "relations", permission: "fixture.relations" }, relatedModule: "related" }] },
    }));
    const expected = ["Tổng quan", "Quan hệ", "Bổ sung", surface === "BO" ? "Đăng ký" : "Địa điểm", "Lịch sử"];
    for (const selected of ["overview", "relations", "enrollments", "history"]) {
      const out = html(h(TddDetail, { ...f, activeTab: selected, onBack: noop, subject: { type: "fixture", id: f.record.id } }));
      assert.equal((out.match(/data-tdd-shell="detail"/g) ?? []).length, 1);
      const labels = [...out.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map(m => m[1]);
      assert.deepEqual(labels, expected);
      assert.equal((out.match(/role="tablist"/g) ?? []).length, 1);
      assert.equal((out.match(/role="tabpanel"/g) ?? []).length, 1);
      assert.equal((out.match(/aria-selected="true"/g) ?? []).length, 1);
      const mounted = new Set([...out.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
      for (const [, controlled] of out.matchAll(/aria-controls="([^"]+)"/g)) assert.ok(mounted.has(controlled), `missing controlled target ${controlled}`);
      const activeIndex = ["overview", "relations", "more", "enrollments", "history"].indexOf(selected);
      assert.match(out, new RegExp(`role="tabpanel" aria-labelledby="detail-tab-${activeIndex}"`));
      assert.match(out, new RegExp(`id="detail-tab-${activeIndex}" aria-selected="true"`));
      assert.equal((out.match(/tabindex="0"/g) ?? []).length, 2, "keyboard-selected tab and panel only");
    }
  });

  test(`G2 ${surface}: denied state and readonly forms never expose foreign record or privileged action`, () => {
    const f = fixture(surface);
    const privateRecord = { ...f.record, name: "Sensitive-PINO-Record", internalOnly: "NONPUBLIC-CANARY" };
    const deniedContext = { ...f.context, authorize: () => false };
    const missing = surface === "BO" ? { ...f.context, centerId: "" } : { surface: "BO" as const, centerId: "other", authorize: () => true };
    for (const context of [deniedContext, missing]) {
      const detail = html(h(TddDetail, { ...f, context, record: privateRecord, onBack: noop, subject: { type: "fixture", id: f.record.id } }));
      const table = html(h(TddTable, { ...f, context, rows: [privateRecord], status: "ready", onQueryChange: noop, onOpen: noop }));
      for (const value of [detail, table]) {
        assert.match(value, /Không có quyền/);
        assert.doesNotMatch(value, /Sensitive-PINO-Record|NONPUBLIC-CANARY|Quan hệ|Thay đổi/);
      }
    }
    const readOnly = { ...f.context, authorize: (p: string) => p === "fixture.read" };
    const drawer = html(h(TddDrawer, { ...f, context: readOnly, record: privateRecord, onClose: noop, onDetail: noop }));
    assert.doesNotMatch(drawer, /NONPUBLIC-CANARY|data-edit=|edit-popover/);
    assert.match(drawer, /data-tdd-shell="drawer"/);
  });

  test(`G2 ${surface}: typed invalid Table interactions fail before reaching the registered adapter`, () => {
    const f = fixture(surface);
    assert.throws(() => validateQuery(f.schema, { ...f.query, order: ["count", "name", "id"] }, f.context), /identity/i);
    assert.throws(() => validateQuery(f.schema, { ...f.query, visible: ["count", "id"] }, f.context), /identity/i);
    assert.throws(() => validateQuery(f.schema, { ...f.query, pageSize: 999 }, f.context), /pagination/i);
    assert.throws(() => validateQuery(f.schema, { ...f.query, filters: { logic: "AND", rules: [{ field: "count", op: "gte", value: "not-a-number" }] } }, f.context), /filter operand/i);
    assert.throws(() => validateQuery(f.schema, { ...f.query, group: { field: "not-registered", direction: "asc", collapsed: [], hidden: [], hideEmpty: false } }, f.context), /group/i);
    assert.doesNotThrow(() => validateQuery(f.schema, { ...f.query, sort: { field: "count", direction: "desc" }, pageSize: 15 }, f.context));
  });
}

test("G2: dialog policy closes on Escape, wraps Tab in both directions and never steals editor keystrokes", () => {
  const calls: string[] = [], first = { focus: () => calls.push("first") }, last = { focus: () => calls.push("last") };
  const event = (key: string, shiftKey = false) => ({ key, shiftKey, preventDefault: () => calls.push("prevent") });
  const state = { editorOpen: false, first, last, active: last, containsActive: true, close: () => calls.push("close") };
  handleDialogKey(event("Tab"), state); assert.deepEqual(calls.splice(0), ["prevent", "first"]);
  handleDialogKey(event("Tab", true), { ...state, active: first }); assert.deepEqual(calls.splice(0), ["prevent", "last"]);
  handleDialogKey(event("Tab"), { ...state, active: null, containsActive: false }); assert.deepEqual(calls.splice(0), ["prevent", "first"]);
  handleDialogKey(event("Escape"), state); assert.deepEqual(calls.splice(0), ["prevent", "close"]);
  handleDialogKey(event("Escape"), { ...state, editorOpen: true }); assert.deepEqual(calls, [], "editor owns Escape while open");
  assert.deepEqual(["ArrowLeft", "ArrowRight", "Home", "End"].map(key => nextTabIndex(key, 0, 5)), [4, 1, 0, 4]);
  assert.equal(nextTabIndex("ArrowRight", 0, 0), null, "zero tabs must not compute NaN");
});

test("PAP-1117 property presentation receives only authorized projection and overview fields", () => {
 const f = fixture("HO", s => ({ ...s, fields: s.fields.map(field => field.key === "count" ? { ...field, permission: "fixture.secret" } : field) }));
 const context = { ...f.context, authorize: (permission: string) => permission !== "fixture.secret" };
 let calls = 0;
 const renderOverviewProperties: NonNullable<Parameters<typeof TddDetail>[0]["renderOverviewProperties"]> = properties => {
  calls++; assert.deepEqual(properties.fields.map(field => field.key), ["name", "id"]);
  assert.deepEqual(properties.sections[0].fields, ["name", "id"]);
  assert.equal(Object.hasOwn(properties.record, "count"), false);
  return h("p", null, properties.record.name);
 };
 const props = { ...f, context, renderOverviewProperties, onBack: noop, subject: { type: "fixture", id: f.record.id } };
 assert.match(html(h(TddDetail, props)), /Bảo Trân/); assert.equal(calls, 1);
 html(h(TddDetail, { ...props, activeTab: "history" }));
 html(h(TddDetail, { ...props, status: "loading" }));
 html(h(TddDetail, { ...props, context: { ...context, authorize: () => false } }));
 assert.equal(calls, 1);
});
