import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleStaffPinLogin, type StaffPinLoginEnv } from "./staff-pin-login-handler";

const clientId = "google-client-id.apps.googleusercontent.com";

async function authFixture(email = "staff@example.com") {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "google-staff";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email, email_verified: true })
    .setProtectedHeader({ alg: "RS256", kid: "google-staff" })
    .setIssuer("https://accounts.google.com")
    .setAudience(clientId)
    .setSubject("google-staff-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function env(binding: StaffPinLoginEnv["PINO_STAFF_PIN_CORE"]): StaffPinLoginEnv {
  return { GOOGLE_SSO_CLIENT_ID: clientId, PINO_STAFF_PIN_CORE: binding };
}

test("staff PIN login is bound to the verified Google email", async () => {
  const auth = await authFixture("verified.staff@example.com");
  let loginIdentifier = "";
  const response = await handleStaffPinLogin(
    new Request("https://tos.pinohouse.art/api/staff-pin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: auth.token, pin: "123456" }),
    }),
    env({
      login: async input => { loginIdentifier = input.loginIdentifier; return { status: 403, body: { error: {} }, requestId: "req-1" }; },
      configure: async () => ({ status: 200, body: {}, requestId: "x" }),
      resolve: async () => ({ status: 200, body: {}, requestId: "x" }),
      logout: async () => ({ status: 200, body: {}, requestId: "x" }),
    }),
    auth.resolver,
  );
  assert.equal(response.status, 403);
  assert.equal(loginIdentifier, "verified.staff@example.com");
});

test("successful Google + PIN login sets a protected staff session cookie", async () => {
  const auth = await authFixture();
  const response = await handleStaffPinLogin(
    new Request("https://tos.pinohouse.art/api/staff-pin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: auth.token, pin: "123456" }),
    }),
    env({
      login: async () => ({ status: 200, body: { data: { token: "opaque-session" } }, requestId: "req-2" }),
      configure: async () => ({ status: 200, body: {}, requestId: "x" }),
      resolve: async () => ({ status: 200, body: {}, requestId: "x" }),
      logout: async () => ({ status: 200, body: {}, requestId: "x" }),
    }),
    auth.resolver,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /pino_staff_session=opaque-session/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Strict/);
});

test("an invalid Google identity token never reaches staff PIN login", async () => {
  let calls = 0;
  const response = await handleStaffPinLogin(
    new Request("https://tos.pinohouse.art/api/staff-pin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "not-a-jwt", pin: "123456" }),
    }),
    env({
      login: async () => { calls += 1; return { status: 200, body: {}, requestId: "x" }; },
      configure: async () => ({ status: 200, body: {}, requestId: "x" }),
      resolve: async () => ({ status: 200, body: {}, requestId: "x" }),
      logout: async () => ({ status: 200, body: {}, requestId: "x" }),
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});
