import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authorizedHostActions, type TddActionDescriptor, type ModuleSchema } from "./workspace-schema";
const file = (s: string) => readFileSync(s, "utf8");
test("PAP-1247: Drawer & Detail route action slots via one shared Action Host, not local buttons", () => {
  const renderer = file("app/components/workspace-renderer/Renderer.tsx");
  const record = file("app/components/workspace-renderer/Record.tsx");
  const drawer = file("app/components/workspace-renderer/DrawerFrame.tsx");
  const detail = file("app/components/workspace-renderer/DetailFrame.tsx");
  const surface = file("app/components/workspace-adapters/SurfaceWorkspace.tsx");
  assert.match(renderer, /slot="drawer\.header" bindings=/);
  assert.match(renderer, /slot="detail\.header" bindings=/);
  assert.match(renderer, /slot="table\.header" bindings=/);
  assert.match(record, /headerActions=\{projection \? headerActions : null\}/);
  assert.match(record, /actions=\{projection \? headerActions : null\}/);
  assert.match(drawer, /data-tdd-action-region="drawer\.header"/);
  assert.match(drawer, /id="drawer-close"/);
  assert.match(detail, /\{actions\}/);
  assert.match(detail, /id="back-to-list"/);
  assert.match(surface, /status: recordStatus, actionBindings, writes/);
  assert.match(surface, /status: recordStatus, actionBindings, onRetry:/);
  assert.doesNotMatch(drawer, /<TosButton/);
});
test("PAP-1247: only authorized bound record actions appear in exact declared record host", () => {
  const descriptors: readonly TddActionDescriptor[] = [
    { id: "archive", label: "Lưu trữ", slot: "detail.header", variant: "danger", capability: "edit", handler: "archive" },
    { id: "edit", label: "Sửa", slot: "drawer.header", variant: "primary", capability: "edit", handler: "edit" },
    { id: "view", label: "Xem", slot: "drawer.header", variant: "secondary", capability: "read", handler: "view" },
  ];
  const schema = { surface: "HO", actions: descriptors, capabilities: { read: "can.read", edit: "can.edit" } } as ModuleSchema;
  const bindings = { archive: { run: () => undefined }, edit: { run: () => undefined }, view: { run: () => undefined } };
  const readOnly = { surface: "HO" as const, authorize: (p: string) => p === "can.read" };
  const manage = { surface: "HO" as const, authorize: () => true };
  assert.deepEqual(authorizedHostActions(schema, readOnly, "drawer.header", bindings).map(a => a.id), ["view"]);
  assert.deepEqual(authorizedHostActions(schema, manage, "drawer.header", bindings).map(a => a.id), ["view", "edit"]);
  assert.deepEqual(authorizedHostActions(schema, manage, "detail.header", bindings).map(a => a.id), ["archive"]);
  assert.deepEqual(authorizedHostActions(schema, manage, "drawer.footer", bindings), []);
  assert.deepEqual(authorizedHostActions(schema, manage, "detail.header", { edit: bindings.edit }), []);
});
test("PAP-1247: no shell host when undeclared and duplicate invocation is locked synchronously", () => {
  const renderer = file("app/components/workspace-renderer/Renderer.tsx");
  assert.match(renderer, /if \(!actions\.length\) return null/);
  assert.match(renderer, /pending\.current\s*\|\|/);
  assert.match(renderer, /pending\.current = true/);
  assert.match(renderer, /pending\.current = false/);
  assert.match(renderer, /aria-busy=\{busy !== null\}/);
});
