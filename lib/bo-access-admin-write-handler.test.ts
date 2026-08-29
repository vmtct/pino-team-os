import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo-access-admin-write";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "founder@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-access-admin-write" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("verified-founder-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function request(path: string, token?: string, body: unknown = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["cf-access-jwt-assertion"] = token;
  return new Request(`https://bo.pinohouse.art/api/bo/${path}?userId=forged&centerId=forged`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function env(binding: BoAccessCoreBinding): BoWriteEnv {
  return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}

test("BO access admin facade forwards only whitelisted role and assignment POSTs with verified identity", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: BoAccessRequest; identity: VerifiedBoIdentity }> = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest, identity) {
      forwarded.push({ request: coreRequest, identity });
      return { status: 201, body: { data: { id: "created" } }, requestId: `core-${forwarded.length}` };
    },
  };
  const roleBody = { roleKey: "tos-learning-operator", displayName: "TOS Learning Operator", permissionKeys: ["session.roster.view"] };
  const assignmentBody = { userId: "00000000-0000-7000-8000-000000000001", roleId: "00000000-0000-7000-8000-000000000002", scopeType: "CENTER", scopeId: "00000000-0000-7000-8000-000000000003" };

  const [roleResponse, assignmentResponse] = await Promise.all([
    handleBoWriteRequest(request("access/roles", f.token, roleBody), env(binding), "access/roles", f.resolver),
    handleBoWriteRequest(request("access/assignments", f.token, assignmentBody), env(binding), "access/assignments", f.resolver),
  ]);

  assert.equal(roleResponse.status, 201);
  assert.equal(assignmentResponse.status, 201);
  assert.equal(forwarded.length, 2);
  assert.deepEqual(
    forwarded.map((item) => item.request).sort((left, right) => left.path.localeCompare(right.path)),
    [
      { method: "POST", path: "access/assignments", body: assignmentBody },
      { method: "POST", path: "access/roles", body: roleBody },
    ],
  );
  for (const item of forwarded) {
    assert.equal(item.identity.subject, "verified-founder-subject");
    assert.equal(item.identity.email, "founder@example.com");
  }
});

test("access admin writes require BO Access identity and reject unlisted write paths before Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const [unauthenticated, unknown] = await Promise.all([
    handleBoWriteRequest(request("access/roles"), env(binding), "access/roles", f.resolver),
    handleBoWriteRequest(request("access/users", f.token), env(binding), "access/users", f.resolver),
  ]);
  assert.equal(unauthenticated.status, 401);
  assert.equal(unknown.status, 404);
  assert.equal(called, false);
});