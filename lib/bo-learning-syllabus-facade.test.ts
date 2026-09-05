import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const session = "local-session-token";
function env(binding: BoAccessCoreBinding): BoReadEnv & BoWriteEnv { return { PINO_BO_CORE: binding }; }
function binding(operation: (request: BoAccessRequest, token: string) => Promise<{ status: number; body: unknown; requestId: string }>): BoAccessCoreBinding {
  return {  executeWithStaffPassword: operation };
}
test("Learning Syllabus reads forward governed paths through local password session", async () => {
  const forwarded: BoAccessRequest[] = [];
  const b = binding(async request => { forwarded.push(request); return { status: 200, body: { data: [] }, requestId: "core-read" }; });
  const headers = { cookie: `pino_staff_password_session=${session}` };
  const cases = [
    ["learning/syllabi/owners", "learning/syllabi/owners"],
    [`learning/syllabi?ownerType=HOUSE_PATH&ownerId=${id}&userId=forged`, `learning/syllabi?ownerType=HOUSE_PATH&ownerId=${id}`],
    [`learning/syllabi/${id}`, `learning/syllabi/${id}`],
    [`learning/syllabi/versions/${id}/artchitect-profile`, `learning/syllabi/versions/${id}/artchitect-profile`],
    [`learning/syllabi/versions/${id}/pianohouse-profile`, `learning/syllabi/versions/${id}/pianohouse-profile`],
    [`learning/syllabi/versions/${id}/little-piner-profile`, `learning/syllabi/versions/${id}/little-piner-profile`],
  ] as const;
  for (const [browserPath, corePath] of cases) {
    const path = browserPath.split("?")[0]!;
    const response = await handleBoOperationalReadRequest(new Request(`https://bo.pinohouse.art/api/bo/${browserPath}`, { headers }), env(b), path);
    assert.equal(response.status, 200);
    assert.equal(forwarded.at(-1)?.path, corePath);
  }
  assert.ok(forwarded.every(request => request.method === "GET" && !Object.hasOwn(request, "resource")));
});

test("Learning Syllabus writes require replay evidence and use local password Core path", async () => {
  const forwarded: BoAccessRequest[] = [];
  const b = binding(async (request, token) => {
    assert.equal(token, session);
    forwarded.push(request);
    return { status: 200, body: { data: { ok: true } }, requestId: "core-write" };
  });
  const cases = [
    ["learning/syllabi", { ownerType: "HOUSE_PATH", ownerId: id, code: "color", title: "Color" }],
    [`learning/syllabi/${id}/draft`, { expectedRevision: 1, title: "Edited" }],
    [`learning/syllabi/${id}/publish`, { expectedRevision: 2 }],
    [`learning/syllabi/${id}/next-draft`, {}],
    [`learning/syllabi/${id}/archive`, { expectedRevision: 1, reason: "Retired" }],
    [`learning/syllabi/versions/${id}/artchitect-profile`, { richContent: { type: "doc", content: [{ type: "paragraph" }] }, worksheetMediaIds: [id], toolTags: ["Brush"], expectedRevision: null }],
    [`learning/syllabi/versions/${id}/pianohouse-profile`, { practiceResourceId: id, practiceResourceVersionId: id, practicePageId: id, expectedRevision: null }],
    [`learning/syllabi/versions/${id}/little-piner-profile`, { richContent: { type: "doc", content: [{ type: "paragraph" }] }, worksheetMediaIds: [id], toolTags: ["Paper"], practiceResourceId: id, practiceResourceVersionId: id, practicePageId: id, expectedRevision: null }],
  ] as const;
  for (const [path, body] of cases) {
    const response = await handleBoWriteRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`, {
      method: "POST",
      headers: { cookie: `pino_staff_password_session=${session}`, "content-type": "application/json", "idempotency-key": `key-${forwarded.length}` },
      body: JSON.stringify(body),
    }), env(b), path);
    assert.equal(response.status, 200);
  }
  assert.deepEqual(forwarded.map(item => item.path), cases.map(item => item[0]));
  assert.ok(forwarded.every(item => item.method === "POST" && Boolean(item.idempotencyKey)));
});

test("Learning Syllabus fails closed on missing replay evidence and preserves Core forbidden", async () => {
  let called = 0;
  const b = binding(async () => { called += 1; return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "core-denied" }; });
  const missing = await handleBoWriteRequest(new Request("https://bo.pinohouse.art/api/bo/learning/syllabi", { method: "POST", headers: { cookie: `pino_staff_password_session=${session}`, "content-type": "application/json" }, body: "{}" }), env(b), "learning/syllabi");
  assert.equal(missing.status, 400); assert.equal(called, 0);
  const path = `learning/syllabi/${id}/publish`;
  const denied = await handleBoWriteRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { cookie: `pino_staff_password_session=${session}`, "content-type": "application/json", "idempotency-key": "publish" }, body: '{"expectedRevision":1}' }), env(b), path);
  assert.equal(denied.status, 403); assert.equal(denied.headers.get("x-request-id"), "core-denied"); assert.equal(called, 1);
});
