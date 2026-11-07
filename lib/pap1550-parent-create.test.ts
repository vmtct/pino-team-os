import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const center = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const otherCenter = "0198d050-56c1-7ac5-b9ab-b0e45d954321";
const path = "identity/parents";
const body = { displayName: "Parent One", contacts: [{ identifierType: "EMAIL", value: "parent@example.invalid", isPrimary: true }] };
const cookie = "pino_staff_password_session=synthetic-session";

function send(query: string, payload: unknown = body, key: string | null = "create-1", authenticated = true, method = "POST") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  if (authenticated) headers.cookie = cookie;
  return new Request("https://bo.pinohouse.art/api/bo/" + path + query, {
    method, headers, ...(method === "GET" ? {} : { body: JSON.stringify(payload) }),
  });
}
function env(consumer: (request: BoAccessRequest) => { status: number; body: unknown }): BoWriteEnv {
  return { PINO_BO_CORE: { async executeWithStaffPassword(request) {
    const result = consumer(request);
    return { status: result.status, body: result.body, requestId: "pap1550" };
  } } as BoAccessCoreBinding } as BoWriteEnv;
}
const handle = (request: Request, binding: BoWriteEnv) => handleBoWriteRequest(request, binding, path);

test("PAP-1550 accepts only explicit Center selected URL, forwards one canonical Core resource", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding = env(request => { forwarded.push(request); return { status: 201, body: { data: { parentUserId: center } } }; });
  const response = await handle(send("?centerId=" + center), binding);
  assert.equal(response.status, 201, await response.clone().text());
  assert.deepEqual(forwarded, [{ method: "POST", path, body, resource: { centerId: center }, idempotencyKey: "create-1" }]);
  assert.equal(response.headers.get("x-request-id"), "pap1550");
});

test("PAP-1550 fail-closes ambiguous Center, spoofed body, unverified contact and missing replay key", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding = env(request => { forwarded.push(request); return { status: 201, body: { data: true } }; });
  const invalid = [
    send(""), send("?centerId=" + center + "&centerId=" + otherCenter),
    send("?centerId=" + center + "&debug=1"),
    send("?centerId=not-a-uuid"),
    send("?centerId=" + center, { ...body, centerId: otherCenter }),
    send("?centerId=" + center, { ...body, contacts: [{ ...body.contacts[0], verified: true }] }),
    send("?centerId=" + center, { ...body, contacts: [] }),
    send("?centerId=" + center, { ...body, contacts: [{ identifierType: "PHONE", value: "" }] }),
    send("?centerId=" + center, body, null),
  ];
  for (const request of invalid) assert.equal((await handle(request, binding)).status, 400, request.url);
  assert.equal(forwarded.length, 0);
});

test("PAP-1550 keeps Core authority for deny; no browser-supplied grant", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding = env(request => {
    forwarded.push(request);
    return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } } };
  });
  assert.equal((await handle(send("?centerId=" + center, body, "key", false), binding)).status, 401);
  assert.equal(forwarded.length, 0);
  { const denied = await handle(send("?centerId=" + center), binding); assert.equal(denied.status, 403, await denied.clone().text()); }
  assert.equal(forwarded.length, 1);
  assert.equal((await handle(send("?centerId=" + center, body, "key", true, "GET"), binding)).status, 405);
  assert.equal(forwarded.length, 1);
});

test("PAP-1550 Parent UI respects TDD header action, named Center and no fake directory entry", () => {
  const source = readFileSync(new URL("../app/bo/parents/ParentTdd.tsx", import.meta.url), "utf8");
  const drawer = readFileSync(new URL("../app/bo/parents/ParentCreateDrawer.tsx", import.meta.url), "utf8");
  assert.match(source, /tableHeaderActions=\{current\.adapter\.context\.authorize\("identity\.parent\.create"\)/);
  assert.match(source, /onClick=\{\(\) => setCreateForCenter\(selected\)\}>\+ Parent<\/button>/);
  assert.match(source, /context\.authorize\("identity\.parent\.create"\)/);
  assert.match(source, /<ParentCreateDrawer centerId=\{selected\}/);
  assert.match(drawer, /UNLINKED_NOT_LISTED|chưa liên kết học viên/);
  assert.match(drawer, /attemptRef\.current/);
  assert.doesNotMatch(drawer, /fetch\(["']http:/);
});
