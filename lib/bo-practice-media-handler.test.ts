import test from "node:test";
import assert from "node:assert/strict";
import { handleBoPracticeMediaUpload, type BoPracticeMediaEnv } from "./bo-practice-media-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const session = "local-session-token";
const pathProgramId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";
function env(binding: BoAccessCoreBinding): BoPracticeMediaEnv { return { PINO_BO_CORE: binding }; }
function uploadRequest(authenticated = true, idempotencyKey = "media-command-1", file?: File) {
  const form = new FormData();
  if (file) form.set("file", file);
  form.set("pathProgramId", pathProgramId);
  const headers: Record<string, string> = {};
  if (authenticated) headers.cookie = `pino_staff_password_session=${session}`;
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return new Request("https://bo.pinohouse.art/api/bo/practice/media", { method: "POST", headers, body: form });
}
test("Practice media forwards bytes only through local password Core binding", async () => {
  const forwarded: BoAccessRequest[] = [];
  const tokens: string[] = [];
  const binding: BoAccessCoreBinding = {

    async executeWithStaffPassword(request, token) {
      forwarded.push(request);
      tokens.push(token);
      return { status: 201, body: { data: { mediaAssetId: "0198d050-56c1-7ac5-b9ab-b0e45d912345", fileName: "sheet.png", mimeType: "image/png", byteSize: 3 } }, requestId: "core-media" };
    },
  };
  const file = new File([new Uint8Array([1, 2, 3])], "sheet.png", { type: "image/png" });
  const response = await handleBoPracticeMediaUpload(uploadRequest(true, "media-command-1", file), env(binding));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-request-id"), "core-media");
  assert.equal(tokens[0], session);
  const request = forwarded[0]!;
  assert.equal(request.method, "POST");
  assert.equal(request.path, "practice/media");
  assert.equal(request.idempotencyKey, "media-command-1");
  const body = request.body as { pathProgramId: string; fileName: string; mimeType: string; bytes: ArrayBuffer };
  assert.equal(body.pathProgramId, pathProgramId);
  assert.equal(body.fileName, "sheet.png");
  assert.equal(body.mimeType, "image/png");
  assert.deepEqual([...new Uint8Array(body.bytes)], [1, 2, 3]);
});
test("Practice media upload fails closed before Core without local password session", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = {

    async executeWithStaffPassword() { called = true; throw new Error("unexpected"); },
  };
  const file = new File(["sheet"], "sheet.png", { type: "image/png" });
  const response = await handleBoPracticeMediaUpload(uploadRequest(false, "media-command-2", file), env(binding));
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Practice media requires replay evidence and a non-empty file", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = {

    async executeWithStaffPassword() { called = true; throw new Error("unexpected"); },
  };
  const file = new File(["sheet"], "sheet.png", { type: "image/png" });
  const missingKey = await handleBoPracticeMediaUpload(uploadRequest(true, "", file), env(binding));
  const missingFile = await handleBoPracticeMediaUpload(uploadRequest(true, "media-command-3"), env(binding));
  assert.equal(missingKey.status, 400);
  assert.equal(missingFile.status, 400);
  assert.equal(called, false);
});
test("Practice media preserves Core authorization denial and request ID", async () => {
  const binding: BoAccessCoreBinding = {

    async executeWithStaffPassword() {
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED", message: "practice.resource.manage required" } }, requestId: "core-practice-denied" };
    },
  };
  const file = new File(["sheet"], "sheet.png", { type: "image/png" });
  const response = await handleBoPracticeMediaUpload(uploadRequest(true, "media-command-4", file), env(binding));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "core-practice-denied");
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ACCESS_PERMISSION_DENIED");
});
