import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  handleBoWorkforceTrainingRequest,
  type BoWorkforceTrainingEnv,
  type WorkforceTrainingCoreBinding,
  type WorkforceTrainingRequest,
} from "./bo-workforce-training-handler";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";
const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "bo-training";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "manager@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-training" })
    .setIssuer(`https://${domain}`).setAudience(audience).setSubject("manager-subject")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  return { resolver, token };
}

function makeEnv(binding: WorkforceTrainingCoreBinding): BoWorkforceTrainingEnv {
  return { PINO_WORKFORCE_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}
test("BO Training catalog forwards only verified identity and bounded path", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: WorkforceTrainingRequest; identity: VerifiedBoIdentity }> = [];
  const binding: WorkforceTrainingCoreBinding = { async executeTraining(request, identity) {
    forwarded.push({ request, identity });
    return { status: 200, body: { data: [] }, requestId: "training-catalog" };
  } };
  const request = new Request("https://bo.pinohouse.art/api/bo/workforce/training/catalog?forgedUser=x", {
    headers: { "cf-access-jwt-assertion": f.token },
  });
  const response = await handleBoWorkforceTrainingRequest(request, makeEnv(binding), "workforce/training/catalog", f.resolver);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "training-catalog");
  assert.deepEqual(forwarded[0]?.request, { method: "GET", path: "catalog", body: { forgedUser: "x" } });
  assert.equal(forwarded[0]?.identity.subject, "manager-subject");
});

test("BO Training mutations preserve exact idempotency keys", async () => {
  const f = await fixture();
  const forwarded: WorkforceTrainingRequest[] = [];
  const binding: WorkforceTrainingCoreBinding = { async executeTraining(request) {
    forwarded.push(request); return { status: 200, body: { data: {} }, requestId: "training-write" };
  } };
  const body = { moduleKey: "classroom", title: "Classroom", lessons: [{ key: "one", title: "One", kind: "READ" }] };
  const request = new Request("https://bo.pinohouse.art/api/bo/workforce/training/modules", {
    method: "POST",
    headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json", "idempotency-key": "module-key" },
    body: JSON.stringify(body),
  });
  const response = await handleBoWorkforceTrainingRequest(request, makeEnv(binding), "workforce/training/modules", f.resolver);
  assert.equal(response.status, 200);
  assert.deepEqual(forwarded[0], { method: "POST", path: "modules", body, idempotencyKey: "module-key" });
});

test("BO Training lifecycle allowlist includes next draft, retire, sign-off and qualification revoke", async () => {
  const f = await fixture();
  const paths = [
    `workforce/training/modules/${id}/next-draft`,
    `workforce/training/modules/${id}/retire`,
    `workforce/training/assignments/${id}/signoff`,
    `workforce/training/qualifications/${id}/revoke`,
  ];
  let calls = 0;
  const binding: WorkforceTrainingCoreBinding = { async executeTraining() {
    calls += 1; return { status: 200, body: { data: {} }, requestId: "lifecycle" };
  } };
  for (const path of paths) {
    const request = new Request(`https://bo.pinohouse.art/api/bo/${path}`, {
      method: "POST",
      headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json", "idempotency-key": `key-${calls}` },
      body: JSON.stringify({ reason: "review", note: "ok" }),
    });
    assert.equal((await handleBoWorkforceTrainingRequest(request, makeEnv(binding), path, f.resolver)).status, 200, path);
  }
  assert.equal(calls, paths.length);
});

test("BO Training missing replay evidence and unknown routes fail before Core", async () => {
  const f = await fixture(); let called = false;
  const binding: WorkforceTrainingCoreBinding = { async executeTraining() { called = true; throw new Error("unexpected"); } };
  const noKey = new Request("https://bo.pinohouse.art/api/bo/workforce/training/modules", {
    method: "POST", headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json" }, body: JSON.stringify({}),
  });
  const unknown = new Request("https://bo.pinohouse.art/api/bo/workforce/training/delete-all", { headers: { "cf-access-jwt-assertion": f.token } });
  assert.equal((await handleBoWorkforceTrainingRequest(noKey, makeEnv(binding), "workforce/training/modules", f.resolver)).status, 400);
  assert.equal((await handleBoWorkforceTrainingRequest(unknown, makeEnv(binding), "workforce/training/delete-all", f.resolver)).status, 404);
  assert.equal(called, false);
});
