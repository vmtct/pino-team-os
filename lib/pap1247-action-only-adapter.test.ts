import test from "node:test";
import assert from "node:assert/strict";
import { hasActionOnlyCapability } from "./workspace-adapters/adapter";
import type { ModuleSchema, FieldSchema } from "./workspace-schema";
const fields = [{
  key: "name", label: "Name", type: "text", icon: "Aa", width: 180,
  readOnly: true, permission: "catalog.learning.view",
  capabilities: { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false },
}] as const satisfies readonly FieldSchema[];
type F = typeof fields;
const base = {
  fields, table: { inlineEdit: { enabled: false, fields: [] as const } },
  capabilities: { read: "catalog.learning.view", create: "learning.mission.manage", edit: "learning.mission.manage" },
  actions: [
    { id: "open", label: "Tạo", slot: "table.header", variant: "primary",
      capability: "create", handler: "openCreate" },
    { id: "save", label: "Lưu", slot: "drawer.footer", variant: "primary", formMode: "create",
      capability: "create", handler: "submitCreate" },
    { id: "edit", label: "Sửa", slot: "detail.header", variant: "primary",
      capability: "edit", handler: "openEdit" },
  ],
} as unknown as Pick<ModuleSchema<F>, "actions" | "capabilities" | "table" | "fields">;
const readOnlyProvider = {};
test("PAP-1247: independent HO Founder Create/Edit action is not a generic provider mutation", () => {
  assert.equal(hasActionOnlyCapability(base, readOnlyProvider, "create"), true);
  assert.equal(hasActionOnlyCapability(base, readOnlyProvider, "edit"), true);
  assert.equal("mutation" in readOnlyProvider, false);
});
test("PAP-1247: reject self-declared create/edit without an admitted action or capability", () => {
  for (const capability of ["create", "edit"] as const) {
    assert.equal(hasActionOnlyCapability({ ...base, actions: [] }, readOnlyProvider, capability), false);
    assert.equal(hasActionOnlyCapability({ ...base, capabilities: { ...base.capabilities, [capability]: undefined } }, readOnlyProvider, capability), false);
  }
  assert.equal(hasActionOnlyCapability({ ...base, actions: [{ ...base.actions![0]!, handler: "" }] }, readOnlyProvider, "create"), false);
});
test("PAP-1247: never widen generic BO/HO mutation or inline editor", () => {
  const mutation = { update: () => { throw Error("not for domain actions"); } };
  assert.equal(hasActionOnlyCapability(base, { mutation } as never, "create"), false);
  assert.equal(hasActionOnlyCapability(base, { mutation } as never, "edit"), false);
  const withInline = { ...base, table: { inlineEdit: { enabled: true, fields: ["name"] } } } as typeof base;
  assert.equal(hasActionOnlyCapability(withInline, readOnlyProvider, "create"), false);
  assert.equal(hasActionOnlyCapability(withInline, readOnlyProvider, "edit"), false);
  assert.equal(hasActionOnlyCapability({ ...base, fields: [{ ...fields[0], capabilities: { ...fields[0].capabilities, inlineEdit: true } }] } as never, readOnlyProvider, "create"), false);
});