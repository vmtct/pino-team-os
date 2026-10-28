import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { operators, rulePass, type BoTableState } from "./bo-registration";
import {
  FIELD_TYPES, FIELD_METADATA, FILTER_OPERATORS, TddRegistry, allows, allowsField, authorizedTabs, composeTabs,
  defineTddModule, fromLegacyTableState, isFieldValue, loadHistory, toLegacyModule, toLegacyTableState,
  validateModule, validateQuery, fieldValueErrors,
  type AuthorizationContext, type FieldSchema, type ModuleSchema, type TableQuery, type FilterRule, type EditablePatch,
} from "./workspace-schema";

const bo: AuthorizationContext = { surface: "BO", centerId: "center-a", authorize: () => true };
const ho: AuthorizationContext = { surface: "HO", authorize: () => true };
const denied: AuthorizationContext = { surface: "BO", centerId: "center-a", authorize: () => false };
const caps = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const typedFields = [
  { key: "name", label: "Name", type: "text", icon: "Aa", width: 225, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "count", label: "Count", type: "number", icon: "#", width: 100, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "active", label: "Active", type: "boolean", icon: "?", width: 100, permission: "fixture.read", readOnly: true, capabilities: caps },
] as const satisfies readonly FieldSchema[];

function fixture(surface: "BO" | "HO" = "BO"): ModuleSchema {
  const fields: FieldSchema[] = FIELD_TYPES.map(type => ({ key: type === "text" ? "name" : type, label: type, type, icon: "Aa", width: 150, permission: "fixture.read", readOnly: true, capabilities: caps } as FieldSchema));
  const sections = [{ id: "properties", label: "Properties", fields: fields.map(f => f.key) }];
  return {
    version: 1, classification: "TDD_DEFAULT", key: "fixture", label: "Contract fixture", group: "Tests", surface, fields,
    capabilities: { read: "fixture.read" },
    data: { id: "fixture", list: async () => ({ rows: [], total: 0 }), detail: async () => null },
    table: {
      identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
      columns: fields.map((f, index) => ({ field: f.key, visible: index < 8 })),
      search: { fields: fields.map(f => f.key), normalization: "vi-diacritic-insensitive" },
      filters: { fields: fields.map(f => f.key), mode: "flat", logic: "AND" },
      sort: { fields: fields.map(f => f.key), mode: "single", nulls: "last", tieBreak: "record-id" },
      group: { fields: fields.map(f => f.key), mode: "single" },
      views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
      pagination: { sizes: [8, 15, 30], defaultSize: 8, mode: "local-ui" },
      inlineEdit: { enabled: false, fields: [] },
      interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
    },
    drawer: { density: "one-column", sections, actions: [] },
    detail: { overview: { sections }, businessTabs: [{ id: "related", label: "Related", kind: "relation-grid", relatedModule: "fixture", source: { adapter: "fixture.related", permission: "fixture.related.read" } }], history: { kind: "unavailable", reason: "Chưa có lịch sử khả dụng" } },
  };
}
function query(m = fixture()): TableQuery<readonly FieldSchema[]> {
  return { search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null, order: m.table.columns.map(c => c.field), visible: m.table.columns.filter(c => c.visible).map(c => c.field), page: 1, pageSize: 8 };
}
/** Test malformed external inputs without weakening the public TypeScript contract. */
function replace<T>(input: T, path: string, value: unknown): T {
  function clone(v: unknown): unknown { return Array.isArray(v) ? v.map(clone) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v; }
  const result = clone(input) as T;
  const parts = path.split("."); let target = result as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = value; return result;
}

for (const surface of ["BO", "HO"] as const) test(`${surface}: registers all 16 primitives and owns Overview/business/History order`, () => {
  const original = fixture(surface); const registry = new TddRegistry(); const schema = registry.register(original);
  assert.equal(registry.version, 1); assert.equal(registry.get(surface, "fixture"), schema);
  assert.equal(schema.fields.length, 16); assert.equal(schema.table.columns.filter(c => c.visible).length, 8);
  assert.deepEqual(composeTabs(schema).map(t => [t.id, t.label]), [["overview", "Tổng quan"], ["related", "Related"], ["history", "Lịch sử"]]);
  assert.ok(Object.isFrozen(schema.detail.businessTabs));
  (original.fields as FieldSchema[]).pop(); assert.equal(schema.fields.length, 16);
  assert.throws(() => registry.register(fixture(surface)), /duplicate module/);
});
test("same schema key may register independently on BO and HO", () => {
  const registry = new TddRegistry(); registry.register(fixture()); registry.register(fixture("HO")); assert.equal(registry.list().length, 2);
});
test("operator inventory matches all current BO field types", () => {
  for (const type of FIELD_TYPES) assert.deepEqual(FILTER_OPERATORS[type], operators(type));
  assert.deepEqual(Object.keys(FIELD_METADATA), FIELD_TYPES);
  assert.equal(Object.values(FIELD_METADATA).filter(m => m.editable).length, 14);
});
test("field values retain typed scalars, multi values, nullable and date semantics", () => {
  const sample = { text: "Việt Nam", id: "opaque", select: "active", number: 3.5, currency: 1000, date: "2026-10-27", relation: "opaque", boolean: false, textarea: "long\ntext", datetime: "2026-10-27T10:00:00+07:00", multirelation: ["a"], person: "a", multiselect: ["a", "b"], email: "a@example.test", url: "https://example.test", formula: 3 };
  for (const type of FIELD_TYPES) { assert.ok(isFieldValue(type, sample[type]), type); assert.ok(isFieldValue(type, null)); assert.equal(isFieldValue(type, {}), false); }
  assert.equal(isFieldValue("date", "2026-02-30"), false); assert.equal(isFieldValue("number", "3"), false); assert.equal(isFieldValue("number", NaN), false); assert.equal(isFieldValue("multiselect", [2]), false);
});

const invalidModules: readonly [string, string, unknown][] = [
  ["unknown kind", "fields.0.type", "richtext"], ["duplicate field", "fields.1.key", "name"],
  ["unsupported schema version", "version", 2], ["unknown surface", "surface", "TOS"],
  ["reserved Overview", "detail.businessTabs.0.id", "overview"], ["reserved History", "detail.businessTabs.0.id", "history"],
  ["business shell override", "detail.businessTabs.0.shell", "custom"], ["detail tab override", "detail.tabs", []],
  ["unknown business slot", "detail.businessTabs.0.kind", "custom-jsx"],
  ["hideable identity", "table.identity.hideable", true], ["movable identity", "table.identity.reorderable", true], ["unpin identity", "table.identity.pinned", "right"],
  ["hidden identity", "table.columns.0.visible", false], ["unknown identity", "table.identity.field", "apiField"],
  ["unknown search field", "table.search.fields", ["apiField"]], ["multi sort", "table.sort.mode", "multi"], ["multi group", "table.group.mode", "multi"], ["nested filters", "table.filters.mode", "nested"],
  ["unsupported pagination", "table.pagination.sizes", [10, 25, 50]], ["drawer columns", "drawer.density", "two-column"],
  ["missing history", "detail.history", undefined], ["missing provider", "detail.history", { kind: "provider", source: { adapter: "history", permission: "fixture.history" } }],
  ["empty unavailable reason", "detail.history.reason", ""], ["unbound edit", "table.inlineEdit.enabled", true],
  ["unbound action", "drawer.actions", [{ id: "create", label: "Create", capability: "create" }]],
  ["sensitive search", "fields.0.sensitive", true], ["readonly editor", "fields.0.capabilities.inlineEdit", true], ["immutable id", "fields.1.readOnly", false],
  ["public views without binding", "table.views.saved", { kind: "authorized-service", source: { adapter: "views", permission: "fixture.views" }, scopes: ["shared"], conflict: "version" }],
];
for (const [label, path, value] of invalidModules) test(`registration rejects ${label}`, () => assert.throws(() => defineTddModule(replace(fixture(), path, value))));
test("duplicate business tabs and malformed field/section references fail admission", () => {
  const m = fixture(); assert.throws(() => defineTddModule(replace(m, "detail.businessTabs", [m.detail.businessTabs[0], m.detail.businessTabs[0]])), /duplicate/);
  assert.throws(() => defineTddModule(replace(m, "drawer.sections.0.fields", ["apiField"])));
});
test("every supported operator accepts a typed operand and rejects invalid operators", () => {
  const m = fixture();
  for (const f of m.fields) for (const op of FILTER_OPERATORS[f.type]) {
    const value = ["number", "currency", "formula"].includes(f.type) ? 2 : f.type === "boolean" ? true : ["multiselect", "multirelation"].includes(f.type) ? op === "not_contains" ? "a" : ["a"] : f.type === "date" ? "2026-10-27" : f.type === "datetime" ? "2026-10-27T10:00:00+07:00" : "a";
    validateQuery(m, replace(query(m), "filters.rules", [{ field: f.key, op, ...(["empty", "not_empty"].includes(op) ? {} : { value, ...(op === "between" ? { second: value } : {}) }) }]), bo);
    assert.throws(() => validateQuery(m, replace(query(m), "filters.rules", [{ field: f.key, op: "regex", value }])));
  }
});
for (const [label, path, value] of [
  ["text numeric operator", "filters.rules", [{ field: "name", op: "gt", value: "a" }]],
  ["wrong numeric operand", "filters.rules", [{ field: "number", op: "eq", value: "3" }]],
  ["missing range bound", "filters.rules", [{ field: "number", op: "between", value: 3 }]],
  ["nested rule", "filters.rules", [{ logic: "AND", rules: [] }]],
  ["hidden identity", "visible", ["id"]], ["reordered identity", "order", FIELD_TYPES],
  ["multiple sorts", "sort", [{ field: "name", direction: "asc" }]],
  ["multiple groups", "group", [{ field: "name", direction: "asc" }]],
  ["unknown column", "visible", ["name", "extraApiField"]], ["invalid page", "page", 0],
] as const) test(`query rejects ${label}`, () => assert.throws(() => validateQuery(fixture(), replace(query(), path, value))));

test("metadata capabilities never grant BO/HO or Center authorization", () => {
  const m = fixture(); assert.equal(allows(m, ho, "read"), false); assert.equal(allows(m, denied, "read"), false); assert.equal(allows(m, bo, "edit"), false);
  assert.equal(allows(m, { ...bo, centerId: "" }, "read"), false);
  const readOnly = { ...bo, authorize: (p: string) => p === "fixture.read" };
  assert.deepEqual(authorizedTabs(m, readOnly).map(t => t.id), ["overview", "history"]);
  assert.deepEqual(authorizedTabs(m, denied), []);
  assert.equal(allowsField(m, bo, "name", "inlineEdit"), false);
  assert.throws(() => validateQuery(m, query(), denied), /unauthorized/);
  assert.throws(() => validateQuery(m, query(), ho), /unauthorized/);
  assert.throws(() => validateQuery(m, query(), { ...bo, authorize: () => false }));
});
test("field authorization also gates hidden/query fields independently of schema read", () => {
  const m = replace(fixture(), "fields.2.permission", "private.field"); const context = { ...bo, authorize: (p: string) => p === "fixture.read" };
  assert.equal(allowsField(m, context, "select", "display"), false);
  assert.throws(() => validateQuery(m, replace(query(m), "filters.rules", [{ field: "select", op: "eq", value: "x" }]), context), /unauthorized/);
});
test("authorized edit and shared-view descriptors remain separate from actual grants", () => {
  let m = replace(fixture(), "capabilities", { read: "fixture.read", edit: "fixture.edit", manageSharedViews: "fixture.views.manage" });
  m = replace(m, "fields.0.readOnly", false); m = replace(m, "fields.0.capabilities.inlineEdit", true);
  m = replace(m, "table.inlineEdit", { enabled: true, fields: ["name"] });
  m = replace(m, "table.views.saved", { kind: "authorized-service", source: { adapter: "existing-views", permission: "fixture.views.read" }, scopes: ["personal", "shared"], conflict: "version" });
  validateModule(m); assert.ok(allowsField(m, bo, "name", "inlineEdit")); assert.equal(allowsField(m, denied, "name", "inlineEdit"), false);
});

test("history distinguishes unavailable, denied, authorized empty and real redacted events", async () => {
  const signal = new AbortController().signal; const subject = { type: "fixture", id: "record-a" };
  assert.equal((await loadHistory(fixture(), subject, bo, signal)).status, "unavailable");
  assert.deepEqual(await loadHistory(fixture(), subject, denied, signal), { status: "denied" });
  let calls = 0;
  let m = replace(fixture(), "capabilities.history", "fixture.history");
  m = replace(m, "detail.history", { kind: "provider", source: { adapter: "history", permission: "fixture.history" }, load: async () => { calls++; return { status: "authorized", events: [], nextCursor: null }; } });
  assert.deepEqual(await loadHistory(m, subject, { ...bo, authorize: p => p === "fixture.read" }, signal), { status: "denied" }); assert.equal(calls, 0);
  assert.deepEqual(await loadHistory(m, subject, bo, signal), { status: "authorized", events: [], nextCursor: null });
  const event = { id: "event-a", at: "2026-10-27T10:00:00Z", actor: "Redacted actor", action: "Updated", outcome: "succeeded", source: "subject-history", subject, redacted: true };
  m = replace(m, "detail.history.load", async () => ({ status: "authorized", events: [event], nextCursor: null }));
  assert.equal((await loadHistory(m, subject, bo, signal)).status, "authorized");
  for (const bad of [{ ...event, subject: { ...subject, id: "foreign" } }, { ...event, before: "private" }, { ...event, redacted: false }]) {
    await assert.rejects(loadHistory(replace(m, "detail.history.load", async () => ({ status: "authorized", events: [bad], nextCursor: null })), subject, bo, signal));
  }
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(loadHistory(m, subject, bo, aborted.signal));
  await assert.rejects(loadHistory(replace(m, "detail.history.load", async () => ({ status: "denied", events: [event] })), subject, bo, signal));
});

test("BO and HO legacy metadata and Table state bridge without changing existing APIs", () => {
  for (const surface of ["BO", "HO"] as const) {
    const m = fixture(surface); const context: AuthorizationContext = surface === "BO" ? bo : ho;
    assert.deepEqual(toLegacyModule(m).fields.map(f => f.type), FIELD_TYPES);
    assert.ok(toLegacyModule(m).fields.every(f => f.readonly));
    const q = replace(query(m), "filters.rules", [{ field: "number", op: "between", value: 1, second: 5 }, { field: "multiselect", op: "any", value: ["a", "b"] }, { field: "multiselect", op: "not_contains", value: "a" }]);
    const legacy: BoTableState = toLegacyTableState(m, q, context); assert.deepEqual(fromLegacyTableState(m, legacy, context), q);
    assert.throws(() => fromLegacyTableState(m, { ...legacy, rules: [{ field: "apiField", op: "eq", value: "x", second: "" }] }, context));
  }
});
test("legacy classification owns no mandatory tabs; special screens and extensions fail closed without verified approval", () => {
  const registry = new TddRegistry(undefined, s => s.surface === "BO" && s.route === "/bo/legacy" && s.evidence === "deployed-source-receipt");
  assert.throws(() => new TddRegistry().registerCompatibility({ classification: "GRANDFATHERED", surface: "BO", key: "new-bypass", route: "/bo/new", owner: "owner", evidence: "unverified", migrationTask: "PAP-1086" }), /not verified/);
  registry.registerCompatibility({ classification: "GRANDFATHERED", surface: "BO", key: "legacy", route: "/bo/legacy", owner: "owner", evidence: "deployed-source-receipt", migrationTask: "PAP-1086" });
  const approval = { jira: "PAP-1085", owner: "Founder", designAuthority: "approved-profile", files: ["exact/file.tsx"], tests: ["exact.test.ts"], reviewBy: "2026-12-01" };
  const special = { classification: "FOUNDER_APPROVED_SPECIAL", surface: "HO", key: "special", route: "/ho/special", approval } as const;
  assert.throws(() => registry.registerCompatibility(special), /not verified/);
  const admitted = new TddRegistry((a, scope) => a.jira === "PAP-1085" && scope.route === "/ho/special");
  admitted.registerCompatibility(special); assert.equal(admitted.list()[0].classification, "FOUNDER_APPROVED_SPECIAL");
  assert.throws(() => admitted.registerCompatibility({ ...special, key: "other", route: "/ho/other" }));
  const extension = replace(fixture(), "detail.businessTabs", [{ id: "extension", label: "Extension", kind: "approved-extension", source: { adapter: "extension", permission: "fixture.read" }, extensionId: "bounded", approval }]);
  assert.throws(() => registry.register(extension), /not verified/);
  assert.equal(new TddRegistry((a, scope) => a.jira === "PAP-1085" && scope.extensionId === "bounded" && scope.key === "fixture").register(extension).detail.businessTabs[0].id, "extension");
  assert.throws(() => registry.registerCompatibility(replace(special, "route", "/ho/*")));
});
test("contract stays renderer-free and runtime adapters never auto-register legacy modules", () => {
  for (const file of readdirSync(join(process.cwd(), "lib/workspace-schema"))) {
    assert.ok(!file.endsWith("tsx"));
    const source = readFileSync(join(process.cwd(), "lib/workspace-schema", file), "utf8");
    assert.doesNotMatch(source, /from ["']react["']|\.css["']|dangerouslySetInnerHTML/);
  }
  for (const file of ["app/ho/HoWorkspace.tsx", "app/bo/components/registration/BoRegistrationWorkspace.tsx"]) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.match(source, /tdd\?:\s*TddStage/);
    assert.doesNotMatch(source, /new TddRegistry|defineTddModule|registerCompatibility/);
  }
});

/** Compiled by tsc; deliberately not executed by node:test. */
function compileTimeNegatives() {
  const rule: FilterRule<typeof typedFields> = { field: "count", op: "between", value: 1, second: 3 };
  // @ts-expect-error Boolean filters cannot use numeric operators.
  const wrongOperator: FilterRule<typeof typedFields> = { field: "active", op: "gt", value: true };
  // @ts-expect-error Numeric filters cannot consume legacy strings.
  const wrongValue: FilterRule<typeof typedFields> = { field: "count", op: "eq", value: "1" };
  // @ts-expect-error A range requires both operands.
  const missingBound: FilterRule<typeof typedFields> = { field: "count", op: "between", value: 1 };
  // @ts-expect-error Arbitrary API fields are not registered fields.
  const unknownField: FilterRule<typeof typedFields> = { field: "apiField", op: "eq", value: "x" };
  // @ts-expect-error Unknown primitive requires a reviewed future contract version.
  const unknownType: FieldSchema = { ...typedFields[0], type: "json" };
  // @ts-expect-error Protected ID cannot be editable.
  const editableId: FieldSchema = { ...typedFields[0], type: "id", readOnly: false };
  // @ts-expect-error Readonly fields cannot be updated through the mutation interface.
  const protectedPatch: EditablePatch<typeof typedFields> = { name: "changed" };
  return [rule, wrongOperator, wrongValue, missingBound, unknownField, unknownType, editableId, protectedPatch];
}
void compileTimeNegatives;

for (const surface of ["BO", "HO"] as const) {
  test(`${surface}: nonempty search requires configured searchable fields`, () => {
    const schema = replace(fixture(surface), "table.search.fields", []);
    const context = surface === "BO" ? bo : ho;
    validateModule(schema);
    validateQuery(schema, query(schema), context);
    for (const search of ["VIP", " ", "Việt Nam"]) {
      assert.throws(() => validateQuery(schema, replace(query(schema), "search", search), context), /searchable field/);
      assert.throws(() => validateQuery(schema, replace(query(schema), "search", search)), /searchable field/);
    }
    const searchable = fixture(surface);
    validateQuery(searchable, replace(query(searchable), "search", "Việt Nam"), context);
  });
  for (const field of ["multiselect", "multirelation"] as const) {
    for (const op of ["any", "all"] as const) {
      test(`${surface}: ${field} ${op} rejects unrepresentable legacy operands`, () => {
        const schema = fixture(surface); const context = surface === "BO" ? bo : ho;
        for (const value of [["VIP,Gold", "Other"], ["VIP", " Gold"], ["VIP", "Gold "], ["VIP", "\u00a0Gold"], [""], [" "], [], [",", "Other"], ["VIP\\,Gold"], ['"VIP,Gold"']]) {
          const state = replace(query(schema), "filters.rules", [{ field, op, value }]);
          validateQuery(schema, state, context);
          assert.throws(() => toLegacyTableState(schema, state, context), /unrepresentable legacy multi-value/);
        }
        for (const value of ["", " ", ",", "VIP,", ",VIP", "VIP,,Other", "VIP, ,Other"]) {
          const legacy: BoTableState = { ...toLegacyTableState(schema, query(schema), context), rules: [{ field, op, value, second: "" }] };
          assert.throws(() => fromLegacyTableState(schema, legacy, context), /unrepresentable legacy multi-value/);
        }
      });
      test(`${surface}: ${field} ${op} preserves representable values and legacy matching`, () => {
        const schema = fixture(surface); const context = surface === "BO" ? bo : ho;
        for (const value of [["VIP", "Other"], ["Tiếng Việt", "VIP Gold"], ['"VIP"', "path\\Gold"], ["VIP，Gold", "Other"], ["VIP", "VIP"]]) {
          const state = replace(query(schema), "filters.rules", [{ field, op, value }]);
          const legacy = toLegacyTableState(schema, state, context);
          assert.deepEqual(fromLegacyTableState(schema, legacy, context), state);
          for (const actual of [value, value.slice(0, 1), ["unrelated"], []]) {
            const expected = op === "any" ? value.some(v => actual.includes(v)) : value.every(v => actual.includes(v));
            assert.equal(rulePass({ id: "row", name: "Record", [field]: actual }, legacy.rules[0], toLegacyModule(schema).fields), expected);
          }
        }
        // Spaces surrounding CSV tokens are stripped by the existing legacy matcher.
        const legacy = toLegacyTableState(schema, query(schema), context);
        legacy.rules = [{ field, op, value: " VIP , Other ", second: "" }];
        const decoded = fromLegacyTableState(schema, legacy, context);
        assert.deepEqual(decoded.filters.rules, [{ field, op, value: ["VIP", "Other"] }]);
      });
    }
    test(`${surface}: ${field} not_contains keeps commas as literal text`, () => {
      const schema = fixture(surface); const context = surface === "BO" ? bo : ho;
      const state = replace(query(schema), "filters.rules", [{ field, op: "not_contains", value: "VIP,Gold" }]);
      assert.deepEqual(fromLegacyTableState(schema, toLegacyTableState(schema, state, context), context), state);
    });
  }
}

test("field validation metadata is typed, bounded and independent of domain validation", () => {
  const field = { ...typedFields[1], required: true, validation: { min: 0, max: 10, integer: true } };
  assert.deepEqual(fieldValueErrors(field, null), ["required"]);
  assert.deepEqual(fieldValueErrors(field, -1.5), ["min", "integer"]);
  assert.deepEqual(fieldValueErrors(field, 11), ["max"]);
  assert.deepEqual(fieldValueErrors(field, 5), []);
  assert.deepEqual(fieldValueErrors({ ...typedFields[0], type: "email" }, "bad"), ["email"]);
  assert.deepEqual(fieldValueErrors({ ...typedFields[0], type: "url" }, "javascript:alert(1)"), ["url"]);
  assert.throws(() => defineTddModule(replace(fixture(), "fields.0.validation", { min: 0 })));
  assert.throws(() => defineTddModule(replace(fixture(), "fields.3.validation", { min: 5, max: 1 })));
});
test("approved typed business slots preserve declaration order and reject shell properties", () => {
  const base = { source: { adapter: "fixture", permission: "fixture.read" } };
  const slots = [
    { ...base, id: "fields", label: "Fields", kind: "field-group", sections: [{ id: "main", label: "Main", fields: ["name"] }] },
    { ...base, id: "rows", label: "Rows", kind: "data-grid", relatedModule: "fixture" },
    { ...base, id: "form", label: "Form", kind: "form", fields: ["name"], submitPermission: "fixture.edit" },
    { ...base, id: "timeline", label: "Timeline", kind: "timeline", dateField: "date" },
    { ...base, id: "media", label: "Media", kind: "media", fields: ["url"] },
    { ...base, id: "metrics", label: "Metrics", kind: "metric-cards", fields: ["number"] },
    { ...base, id: "audit", label: "Audit dataset", kind: "audit-events", subjectType: "separate-dataset" },
  ];
  const schema = replace(fixture(), "detail.businessTabs", slots);
  assert.deepEqual(composeTabs(schema).map(t => t.id), ["overview", ...slots.map(s => s.id), "history"]);
  assert.equal(schema.capabilities.edit, undefined, "business form submit is independent from generic CRUD edit");
  const salaryKeys = ["amount", "effectiveFrom", "reason"];
  assert.doesNotThrow(() => defineTddModule(replace(schema, "detail.businessTabs.2.fields", salaryKeys)), "form fields belong to the business provider, not the public Staff directory");
  assert.throws(() => defineTddModule(replace(schema, "detail.businessTabs.2.fields", ["amount", "amount"])), /duplicate/);
  assert.throws(() => defineTddModule(replace(schema, "detail.businessTabs.2.fields", ["staff.*"])), /invalid business form field key/);
  assert.throws(() => defineTddModule(replace(schema, "detail.businessTabs.2.submitPermission", "fixture.read")), /distinct/);
  assert.throws(() => defineTddModule(replace(schema, "detail.businessTabs.2.submitPermission", "")), /nonempty/);
  assert.throws(() => defineTddModule(replace(schema, "detail.businessTabs.0.className", "shell")));
});
test("history diffs require registered, authorized, correctly typed field projections", async () => {
  const subject = { type: "fixture", id: "a" }; const signal = new AbortController().signal;
  const base = replace(fixture(), "capabilities.history", "fixture.history");
  for (const [changes, valid] of [
    [[{ field: "number", before: 1, after: 2 }], true],
    [[{ field: "number", before: "1", after: 2 }], false],
    [[{ field: "apiField", before: "private", after: "private" }], false],
  ] as const) {
    const schema = replace(base, "detail.history", { kind: "provider", source: { adapter: "history", permission: "fixture.history" }, load: async () => ({ status: "authorized", events: [{ id: "event", at: "2026-10-27T10:00:00Z", actor: "Redacted", action: "Updated", source: "audit", outcome: "succeeded", subject, redacted: true, changes }], nextCursor: null }) });
    if (valid) assert.equal((await loadHistory(schema, subject, bo, signal)).status, "authorized");
    else await assert.rejects(loadHistory(schema, subject, bo, signal), /history diff/);
  }
});
test("literal field schemas retain typed BO/HO data adapters and query references", () => {
  const sections = [{ id: "main", label: "Main", fields: ["name", "count", "active"] as const }];
  for (const surface of ["BO", "HO"] as const) {
    const base = fixture(surface);
    const spec: ModuleSchema<typeof typedFields> = {
      ...base, fields: typedFields,
      data: { id: "literal-fixture", list: async () => ({ rows: [{ id: "a", name: "Tên", count: 1, active: true }], total: 1 }), detail: async () => null },
      table: { ...base.table,
        identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
        columns: typedFields.map(f => ({ field: f.key, visible: true })),
        search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
        filters: { fields: ["count", "active"], mode: "flat", logic: "AND" },
        sort: { fields: ["count"], mode: "single", nulls: "last", tieBreak: "record-id" },
        group: { fields: ["active"], mode: "single" },
        views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["apply"] }, inlineEdit: { enabled: false, fields: [] },
      },
      drawer: { density: "one-column", sections, actions: [] }, detail: { overview: { sections }, businessTabs: [], history: base.detail.history },
    };
    const registered = new TddRegistry().register(spec);
    const state: TableQuery<typeof typedFields> = { search: "", filters: { logic: "AND", rules: [{ field: "count", op: "gte", value: 1 }] }, sort: null, group: null, order: ["name", "count", "active"], visible: ["name"], page: 1, pageSize: 8 };
    validateQuery(registered, state, surface === "BO" ? bo : ho);
    assert.deepEqual(composeTabs(registered).map(t => t.id), ["overview", "history"]);
  }
});
