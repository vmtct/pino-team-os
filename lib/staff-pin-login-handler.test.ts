import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleStaffPinLogin, type StaffPinLoginEnv } from "./staff-pin-login-handler";

const domain = "team.cloudflareaccess.com";
const audience = "tos-audience";

async function authFixture(email = "staff@example.com") {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "staff-pin";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "staff-pin" })
    .setIssuer(`https://${domain}`).setAudience(audience).setSubject("staff-subject")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  return { resolver, token };
}

test("staff PIN login is bound to the verified Cloudflare email", async () => {
  const auth = await authFixture("verified.staff@example.com");
  let loginIdentifier = "";
  const env: StaffPinLoginEnv = {
    CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_TOS_AUD: audience,
    PINO_STAFF_PIN_CORE: { login: async input => { loginIdentifier = input.loginIdentifier; return { status: 403, body: { error: {} }, requestId: "req-1" }; }, configure: async () => ({ status: 200, body: {}, requestId: "x" }), logout: async () => ({ status: 200, body: {}, requestId: "x" }) },
  };  const request = new Request("https://tos.pinohouse.art/api/staff-pin/login", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-access-jwt-assertion": auth.token },
    body: JSON.stringify({ loginIdentifier: "other.staff@example.com", pin: "123456" }),
  });
  const response = await handleStaffPinLogin(request, env, auth.resolver);
  assert.equal(response.status, 403);
  assert.equal(loginIdentifier, "verified.staff@example.com");
});

test("successful staff PIN login sets a protected session cookie", async () => {
  const auth = await authFixture();
  const env: StaffPinLoginEnv = {
    CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_TOS_AUD: audience,
    PINO_STAFF_PIN_CORE: { login: async () => ({ status: 200, body: { data: { token: "opaque-session" } }, requestId: "req-2" }), configure: async () => ({ status: 200, body: {}, requestId: "x" }), logout: async () => ({ status: 200, body: {}, requestId: "x" }) },
  };
  const request = new Request("https://tos.pinohouse.art/api/staff-pin/login", { method: "POST", headers: { "content-type": "application/json", "cf-access-jwt-assertion": auth.token }, body: JSON.stringify({ pin: "123456" }) });
  const response = await handleStaffPinLogin(request, env, auth.resolver);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /pino_staff_session=opaque-session/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
});
