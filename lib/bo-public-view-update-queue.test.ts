import test from "node:test";
import assert from "node:assert/strict";
import { BoPublicViewUpdateQueue, type BoViewUpdateIntent } from "./bo-public-view-update-queue";
import { defaultBoViewConfig, type BoPublicView, type BoViewConfig } from "./bo-public-view-state";

const fields = ["name", "id", "status", "student", "amount"];
const initial = defaultBoViewConfig(fields);
const config = (search: string): BoViewConfig => ({
  ...defaultBoViewConfig(fields),
  search,
  sort: { field: "name", direction: "asc" },
});
const command = (id: string, name: string, version = 2): BoViewUpdateIntent => ({
  kind: "update", moduleKey: "subscriptions", id, expectedVersion: version, config: config(name),
});
const response = (c: BoViewUpdateIntent, version = c.expectedVersion + 1): BoPublicView => ({
  id: c.id, moduleKey: c.moduleKey, name: c.id, position: 0, version, config: c.config,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("coalesces rapid changes into latest config, no duplicate write", async () => {
  const commands: BoViewUpdateIntent[] = [];
  const receipts: number[] = [];
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => { commands.push(c); return response(c); },
    onAcknowledged: (_, revision) => receipts.push(revision),
  });
  q.enqueue(command("v1", "First"));
  q.enqueue(command("v1", "Second"));
  q.enqueue(command("v1", "Last"));
  assert.equal(q.snapshot("v1")?.revision, 3);
  await q.flush();
  assert.equal(commands.length, 1);
  assert.equal(commands[0].config.search, "Last");
  assert.equal(commands[0].expectedVersion, 2);
  assert.deepEqual(receipts, [3]);
  assert.equal(q.snapshot("v1")?.expectedVersion, 3);
  assert.equal(q.snapshot("v1")?.status, "idle");
  q.dispose();
});

test("edits arriving during in-flight request follow exact Core acknowledgement version", async () => {
  const wait = deferred<BoPublicView>();
  const commands: BoViewUpdateIntent[] = [];
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: c => { commands.push(c); return commands.length === 1 ? wait.promise : Promise.resolve(response(c)); },
  });
  q.enqueue(command("v1", "First", 5));
  const running = q.flush();
  await tick();
  assert.equal(commands.length, 1);
  q.enqueue(command("v1", "Second", 5));
  q.enqueue(command("v1", "Latest", 5));
  wait.resolve(response(commands[0], 6));
  await running;
  assert.equal(commands.length, 2);
  assert.equal(commands[1].expectedVersion, 6);
  assert.equal(commands[1].config.search, "Latest");
  assert.equal(q.snapshot("v1")?.expectedVersion, 7);
  q.dispose();
});

test("serializes concurrent changes across different views, not parallel requests", async () => {
  const blocked = deferred<BoPublicView>();
  const commands: BoViewUpdateIntent[] = [];
  let active = 0, peak = 0;
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => {
      commands.push(c); active++; peak = Math.max(peak, active);
      const v = commands.length === 1 ? await blocked.promise : response(c);
      active--;
      return v;
    },
  });
  q.enqueue(command("v1", "A"));
  q.enqueue(command("v2", "B"));
  const flushA = q.flush();
  const flushB = q.flush();
  await tick();
  assert.equal(commands.length, 1);
  blocked.resolve(response(commands[0]));
  await Promise.all([flushA, flushB]);
  assert.equal(commands.length, 2);
  assert.equal(peak, 1);
  q.dispose();
});

test("409 stops view, does not blindly retry, explicit reapply uses server version", async () => {
  const attempted: BoViewUpdateIntent[] = [];
  const issues: string[] = [];
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => {
      attempted.push(c);
      if (attempted.length === 1) throw { status: 409 };
      return response(c);
    },
    onIssue: issue => issues.push(issue.kind),
  });
  q.enqueue(command("v1", "Our changes", 2));
  await q.flush();
  assert.equal(q.snapshot("v1")?.status, "conflict");
  assert.deepEqual(issues, ["version_conflict"]);
  await q.flush();
  assert.equal(attempted.length, 1);
  assert.throws(() => q.enqueue(command("v1", "Unexpected overwrite")), /Resolve current/);
  q.resolveConflict({ id: "v1", serverVersion: 6, action: "reapply" });
  await q.flush();
  assert.equal(attempted[1].expectedVersion, 6);
  assert.equal(q.snapshot("v1")?.status, "idle");
  assert.equal(q.snapshot("v1")?.expectedVersion, 7);
  q.dispose();
});

test("discard 409 never sends again and releases hold", async () => {
  let attempts = 0;
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async () => { attempts++; throw { code: "VERSION_CONFLICT" }; },
  });
  q.enqueue(command("v1", "Bad"));
  await q.flush();
  q.resolveConflict({ id: "v1", serverVersion: 9, action: "discard" });
  await q.flush();
  assert.equal(attempts, 1);
  assert.equal(q.snapshot("v1")?.expectedVersion, 9);
  assert.equal(q.snapshot("v1")?.status, "idle");
  q.dispose();
});

test("network failure holds instead of infinite retry; explicit retry sends again", async () => {
  const commands: BoViewUpdateIntent[] = [];
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => {
      commands.push(c);
      if (commands.length === 1) throw new Error("network");
      return response(c);
    },
  });
  q.enqueue(command("v1", "A"));
  await q.flush(); await q.flush();
  assert.equal(commands.length, 1);
  assert.equal(q.snapshot("v1")?.status, "failed");
  assert.throws(() => q.enqueue(command("v1", "B")), /Resolve current/);
  q.retryRejected("v1");
  await q.flush();
  assert.equal(commands.length, 2);
  assert.equal(q.snapshot("v1")?.status, "idle");
  q.dispose();
});

test("mismatched ID/module and non-advancing ack fail safely", async () => {
  const issues: string[] = [];
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => ({ ...response(c), id: "other", version: c.expectedVersion }),
    onIssue: issue => issues.push(issue.kind),
  });
  q.enqueue(command("v1", "A"));
  await q.flush();
  assert.equal(q.snapshot("v1")?.status, "failed");
  assert.deepEqual(issues, ["rejected"]);
  q.dispose();
});

test("rejects foreign module, stale/invalid field, malformed version and ID", () => {
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => response(c),
  });
  assert.throws(() => q.enqueue({ ...command("v1", "X"), moduleKey: "payroll" }), /module mismatch/);
  assert.throws(() => q.enqueue(command("bad id", "X")), /view ID/);
  assert.throws(() => q.enqueue(command("v1", "X", -1)), /Core view version/);
  assert.throws(() => q.enqueue({ ...command("v1", "X"), config: { ...initial,
    sort: { field: "restricted", direction: "asc" } } }), /Invalid sort/);
  assert.equal(q.snapshot("v1"), null);
  q.dispose();
});

test("user-owned input config remains isolated after enqueue", async () => {
  const sent: BoViewUpdateIntent[] = [];
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 1000,
    send: async c => { sent.push(c); return response(c); },
  });
  const first=command("v1", "Own");
  q.enqueue(first);
  first.config.columns.order.pop();
  first.config.search="Corrupted";
  await q.flush();
  assert.equal(sent[0].config.search, "Own");
  assert.equal(sent[0].config.columns.order.length, fields.length);
  q.dispose();
});

test("dispose clears future debounce writes and prevents new enqueue", async () => {
  let sends = 0;
  const q = new BoPublicViewUpdateQueue({
    moduleKey: "subscriptions", allowedFields: fields, debounceMs: 5,
    send: async c => { sends++; return response(c); },
  });
  q.enqueue(command("v1", "A"));
  q.dispose();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(sends, 0);
  await q.flush();
  assert.throws(() => q.enqueue(command("v1", "B")), /closed/);
});

test("UI acknowledgment observer error never retries a Core-committed write", async () => {
  let writes=0;
  const observed: string[]=[];
  const q=new BoPublicViewUpdateQueue({
    moduleKey:"subscriptions",allowedFields:fields,debounceMs:1000,
    send:async c=>{writes++;return response(c);},
    onAcknowledged:()=>{throw new Error("render observer crash");},
    onObserverError:error=>observed.push((error as Error).message),
  });
  q.enqueue(command("v1","Committed"));
  await q.flush();await q.flush();
  assert.equal(writes,1);
  assert.equal(q.snapshot("v1")?.status,"idle");
  assert.deepEqual(observed,["render observer crash"]);
  q.dispose();
});

for (const frozenThrough of [undefined, null, "status"] as const) test(`PAP-1105 queue preserves freeze ${String(frozenThrough)}`, async () => {
  const sent: BoViewUpdateIntent[] = [];
  const q = new BoPublicViewUpdateQueue({moduleKey:"subscriptions",allowedFields:fields,debounceMs:1000,send:async c=>{sent.push(c);return response(c);}});
  const next = command("v1","Freeze");
  if (frozenThrough !== undefined) next.config.columns.frozenThrough = frozenThrough;
  q.enqueue(next); await q.flush();
  assert.deepEqual(sent[0].config.columns,next.config.columns);
  assert.equal(Object.hasOwn(sent[0].config.columns,"frozenThrough"),frozenThrough !== undefined);
  q.dispose();
});
