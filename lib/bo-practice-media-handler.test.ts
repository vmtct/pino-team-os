import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoPracticeMediaUpload, type BoPracticeMediaEnv } from "./bo-practice-media-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo-practice-media";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "founder@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-practice-media" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("verified-founder-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function env(binding: BoAccessCoreBinding): BoPracticeMediaEnv {
  return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}
function uploadRequest(token?: string, idempotencyKey = "media-command-1", file?: File) {
  const form = new FormData();
  if (file) form.set("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["cf-access-jwt-assertion"] = token;
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return new Request("https://bo.pinohouse.art/api/bo/practice/media", { method: "POST", headers, body: form });
}

test("Practice media facade forwards bytes only through the private Core binding", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: BoAccessRequest; identity: VerifiedBoIdentity }> = [];
  const binding: BoAccessCoreBinding = { async execute(request, identity) {
    forwarded.push({ request, identity });
    return { status: 201, body: { data: { mediaRef: "0198d050-56c1-7ac5-b9ab-b0e45d912345", fileName: "sheet.png", mimeType: "image/png", byteSize: 3 } }, requestId: "core-media" };
  } };
  const file = new File([new Uint8Array([1, 2, 3])], "sheet.png", { type: "image/png" });
  const response = await handleBoPracticeMediaUpload(uploadRequest(f.token, "media-command-1", file), env(binding), f.resolver);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-request-id"), "core-media");
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0]!.request.method, "POST");
  assert.equal(forwarded[0]!.request.path, "practice/media");
  assert.equal(forwarded[0]!.request.idempotencyKey, "media-command-1");
  const body = forwarded[0]!.request.body as { fileName: string; mimeType: string; byteSize: number; bytes: ArrayBuffer };
  assert.equal(body.fileName, "sheet.png");
  assert.equal(body.mimeType, "image/png");
  assert.equal(body.byteSize, 3);
  assert.deepEqual([...new Uint8Array(body.bytes)], [1, 2, 3]);
  assert.equal(forwarded[0]!.identity.subject, "verified-founder-subject");
  assert.equal(forwarded[0]!.identity.email, "founder@example.com");
});

test("Practice media upload fails closed before Core without BO identity", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const file = new File(["sheet"], "sheet.png", { type: "image/png" });
  const response = await handleBoPracticeMediaUpload(uploadRequest(undefined, "media-command-2", file), env(binding));
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Practice media upload requires replay evidence and a non-empty file", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const file = new File(["sheet"], "sheet.png", { type: "image/png" });
  const missingKey = await handleBoPracticeMediaUpload(uploadRequest(f.token, "", file), env(binding), f.resolver);
  const missingFile = await handleBoPracticeMediaUpload(uploadRequest(f.token, "media-command-3"), env(binding), f.resolver);
  assert.equal(missingKey.status, 400);
  assert.equal(missingFile.status, 400);
  assert.equal(called, false);
});
test("Practice media facade preserves Core authorization denial and request ID", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = { async execute() {
    return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED", message: "practice.resource.manage required" } }, requestId: "core-practice-denied" };
  } };
  const file = new File(["sheet"], "sheet.png", { type: "image/png" });
  const response = await handleBoPracticeMediaUpload(uploadRequest(f.token, "media-command-4", file), env(binding), f.resolver);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "core-practice-denied");
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ACCESS_PERMISSION_DENIED");
});
