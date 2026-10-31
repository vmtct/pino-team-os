import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defineTddModule, authorizedHostActions, type ModuleSchema,
  type FieldSchema, type AuthorizationContext } from "./workspace-schema";
const c = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const fields = [{ key: "name", label: "Name", type: "text" as const, icon: "Aa", width: 200,
  permission: "fixture.read", readOnly: true, capabilities: c }] as const satisfies readonly FieldSchema[];
function fixture(): ModuleSchema<typeof fields> {
  const sections = [{ id: "a", label: "Properties", fields: ["name" as const] }];
  return {
    version: 1, classification: "TDD_DEFAULT", key: "fixture", label: "Fixture", group: "Tests",
    surface: "HO", fields, capabilities: { read: "fixture.read", create: "fixture.create" },
    data: { id: "fixture", list: async () => ({ rows: [], total: 0 }), detail: async () => null },
    table: {
      identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
      columns: [{ field: "name", visible: true }],
      search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
      filters: { fields: ["name"], mode: "flat", logic: "AND" },
      sort: { fields: ["name"], mode: "single", nulls: "last", tieBreak: "record-id" },
      group: { fields: ["name"], mode: "single" },
      views: { builtIn: [], saved: { kind: "local-ui" }, actions: [] },
      pagination: { sizes: [8, 15, 30], defaultSize: 8, mode: "local-ui" },
      inlineEdit: { fields: [], enabled: false },
      interaction: { settings: ["properties", "grouping", "filters", "quick-views"],
        quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
    }, drawer: { density: "one-column", sections, actions: [] },
    detail: { overview: { sections }, businessTabs: [],
      history: { kind: "unavailable", reason: "No verified history" } },
  };
}
const primary = { id: "create", label: "Tạo mới", slot: "table.header", variant: "primary",
  capability: "create", handler: "createMission" } as const;
const secondary = { id: "export", label: "Xuất", slot: "table.header", variant: "secondary",
  capability: "read", handler: "export" } as const;
function schema(actions: unknown) {
  return { ...fixture(), actions } as ModuleSchema<typeof fields>;
}
const permitted: AuthorizationContext = { surface: "HO", authorize: () => true };
test("PAP-1247: old modules declare no actions, produce no extra action chrome", () => {
  const old = defineTddModule(fixture());
  assert.equal(old.actions, undefined);
  assert.deepEqual(authorizedHostActions(old, permitted, "table.header", {}), []);
  const renderer = readFileSync("app/components/workspace-renderer/Renderer.tsx", "utf8");
  assert.match(renderer, /<TddActionHost/);
  assert.match(renderer, /view\.props\.actionBindings\s*\?/);
});
test("PAP-1247: rejects unknown slot/variant, duplicate ID, missing handler and two primary", () => {
  assert.doesNotThrow(() => defineTddModule(schema([primary, secondary])));
  const invalid = [[primary, primary], [primary, { ...primary, id: "second" }],
    [{ ...primary, id: "" }], [{ ...primary, handler: "" }],
    [{ ...primary, slot: "header" }], [{ ...primary, variant: "gigantic" }],
    [{ ...primary, capability: "edit" }]];
  for (const actions of invalid)
    assert.throws(() => defineTddModule(schema(actions)), /TDD contract:/);
  const noCap = { ...fixture(), capabilities: { read: "fixture.read" }, actions: [primary] };
  assert.throws(() => defineTddModule(noCap), /capability/);
});
test("PAP-1247: engine owns ordering; auth and actual handler fail closed", () => {
  const registered = defineTddModule(schema([primary, secondary]));
  const handlers = { createMission: { run: () => undefined }, export: { run: () => undefined } };
  assert.deepEqual(authorizedHostActions(registered, permitted, "table.header", handlers).map(x => x.id),
    ["export", "create"]);
  const denied: AuthorizationContext = { surface: "HO", authorize: key => key !== "fixture.create" };
  assert.deepEqual(authorizedHostActions(registered, denied, "table.header", handlers).map(x => x.id), ["export"]);
  assert.deepEqual(authorizedHostActions(registered, permitted, "table.header", { export: handlers.export }).map(x => x.id), ["export"]);
  assert.deepEqual(authorizedHostActions(registered, permitted, "drawer.footer", handlers), []);
});
