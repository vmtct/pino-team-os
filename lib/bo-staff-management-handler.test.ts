import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";
const staffId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "bo-staff-management";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "founder@example.com" }).setProtectedHeader({ alg: "RS256", kid: "bo-staff-management" }).setIssuer(`https://${domain}`).setAudience(audience).setSubject("founder-subject").setIssuedAt().setExpirationTime("5m").sign(privateKey);
  return { resolver, token };
}

function env(binding: BoAccessCoreBinding): BoWriteEnv { return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience }; }
function request(path: string, token: string, body: unknown) { return new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { "cf-access-jwt-assertion": token, "content-type": "application/json" }, body: JSON.stringify(body) }); }
test("Staff management facade forwards only exact governed Staff and Access writes", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: {} }, requestId: `core-${forwarded.length}` }; } };
  const commands: Array<[string, unknown]> = [
    [`workforce/staff-records/${staffId}`, { department: "Music" }],
    [`workforce/staff-records/${staffId}/status`, { status: "inactive" }],
    ["access/assignments/remove", { assignmentId: "0198d050-56c1-7ac5-b9ab-b0e45d912346" }],
    ["access/users/status", { userId: "0198d050-56c1-7ac5-b9ab-b0e45d912347", status: "suspended", reason: "Offboarding" }],
  ];
  for (const [path, body] of commands) {
    const response = await handleBoWriteRequest(request(path, f.token, body), env(binding), path, f.resolver);
    assert.equal(response.status, 200);
  }
  assert.deepEqual(forwarded, commands.map(([path, body]) => ({ method: "POST", path, body })));
});

test("Staff management facade rejects path expansion before Core", async () => {
  const f = await fixture(); let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const path = `workforce/staff-records/${staffId}/documents`;
  const response = await handleBoWriteRequest(request(path, f.token, {}), env(binding), path, f.resolver);
  assert.equal(response.status, 404); assert.equal(called, false);
});
