import test from "node:test";
import assert from "node:assert/strict";
import { defaultBoViewConfig, validateBoViewConfig, loadBoPublicViews, renameBoPublicView, editBoViewConfig, type BoViewConfig, type BoPublicView } from "./bo-public-view-state";
import { BoPublicViewUpdateQueue } from "./bo-public-view-update-queue";
import { BoPublicViewCoreClient } from "./bo-public-view-core-client";
import { fromSharedConfig, toSharedConfig } from "./workspace-adapters/views";
import { centerSchema, centerQuery } from "../app/ho/centers/schema";

const fields = ["name", "id", "status"];
const id = "0199dc10-0000-7000-8000-000000000111";
const omitted = Symbol("omitted");
const config = (boundary: unknown = omitted): BoViewConfig => ({ ...defaultBoViewConfig(fields), columns: { order: [...fields], visible: ["name", "status"], ...(boundary === omitted ? {} : { frozenThrough: boundary }) } } as BoViewConfig);
const row = (value: BoViewConfig, version = 3): BoPublicView => ({ id, moduleKey: "staff", name: "Synthetic view", position: 0, version, config: value });
for (const boundary of [omitted, null, "status"]) {
  const label = boundary === omitted ? "omitted" : String(boundary);
  test("PAP-1105 BO decode, state/rename/edit and queue preserve " + label + " Freeze without inventing omission", async () => {
    const input = config(boundary);
    const decoded = validateBoViewConfig(input, fields);
    assert.deepEqual(decoded, input);
    let state = loadBoPublicViews({ moduleKey: "staff", role: "manager", allowedFields: fields, views: [row(input)], selectedId: id });
    assert.deepEqual(state.effective, input);
    state = renameBoPublicView(state, id, "Renamed").state;
    assert.deepEqual(state.views[0].config, input);
    const edited = editBoViewConfig(state, { ...input, search: "changed" }, fields);
    assert.equal(edited.write?.kind, "update");
    if (edited.write?.kind !== "update") throw Error("missing update");
    const writes: BoViewConfig[] = [];
    const queue = new BoPublicViewUpdateQueue({ moduleKey: "staff", allowedFields: fields, debounceMs: 1000, send: async intent => { writes.push(intent.config); return row(intent.config, intent.expectedVersion + 1); } });
    try {
      queue.enqueue(edited.write); await queue.flush();
      assert.deepEqual(writes, [{ ...input, search: "changed" }]);
      assert.equal(queue.snapshot(id)?.expectedVersion, 4);
      assert.equal(Object.hasOwn(writes[0].columns, "frozenThrough"), boundary !== omitted);
    } finally { queue.dispose(); }
  });
  test("PAP-1105 real Core client decoder preserves " + label + " Freeze", async () => {
    const input = config(boundary);
    const client = new BoPublicViewCoreClient({ baseUrl: "https://bo.staging.pinohouse.art", moduleKey: "staff", allowedFields: fields, role: "staff", bearer: () => "fixture-only", fetchImpl: async () => Response.json({ data: [row(input)] }) });
    assert.deepEqual((await client.list())[0].config, input);
  });
}
for (const boundary of ["hidden", "id", "private", 5, [], {}, undefined]) test("PAP-1105 malformed or protected Freeze is rejected: " + String(boundary), () => {
  const input = config();
  Object.assign(input.columns, { frozenThrough: boundary });
  if (boundary === "hidden") { input.columns.order.push("hidden"); }
  assert.throws(() => validateBoViewConfig(input, [...fields, "hidden"]), /freeze/i);
});
test("PAP-1105 a stale queue write preserves boundary and does not retry or advance version", async () => {
  let calls = 0;
  const queue = new BoPublicViewUpdateQueue({ moduleKey: "staff", allowedFields: fields, debounceMs: 1000, send: async intent => { calls++; assert.equal(intent.config.columns.frozenThrough, "status"); throw Object.assign(Error("conflict"), { status: 409 }); } });
  try {
    queue.enqueue({ kind: "update", moduleKey: "staff", id, expectedVersion: 3, config: config("status") });
    await queue.flush(); await queue.flush();
    assert.equal(calls, 1);
    assert.equal(queue.snapshot(id)?.status, "conflict");
    assert.equal(queue.snapshot(id)?.expectedVersion, 3);
  } finally { queue.dispose(); }
});
test("PAP-1105 typed adapter quarantines non-null Freeze until renderer adoption, but legacy and null still apply", () => {
  const legacy = toSharedConfig(centerSchema, centerQuery);
  assert.deepEqual(fromSharedConfig(centerSchema, legacy), centerQuery);
  const cleared = { ...legacy, columns: { ...legacy.columns, frozenThrough: null } };
  assert.deepEqual(fromSharedConfig(centerSchema, cleared), centerQuery);
  const frozen = { ...legacy, columns: { ...legacy.columns, frozenThrough: "status" } };
  assert.throws(() => fromSharedConfig(centerSchema, frozen), /Freeze.*renderer/i);
  assert.equal(frozen.columns.frozenThrough, "status");
});
