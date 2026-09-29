import test from "node:test";
import assert from "node:assert/strict";
import {
  handleForgotPassword,
  handleResetPassword,
  type StaffPasswordRecoveryEnv,
} from "./staff-password-recovery-handler";

const rawToken = "A".repeat(43);

function request(path: string, body: unknown) {
  return new Request(`https://tos.pinohouse.art${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeEnv(overrides: Partial<StaffPasswordRecoveryEnv> = {}): StaffPasswordRecoveryEnv {
  return {
    PINO_STAFF_PASSWORD_CORE: {
      async establishFromCloudflare() { return { state: "ALREADY_CONFIGURED", loginIdentifier: "staff@pino.invalid" }; },
      async login() { throw new Error("unused"); },
      async status() { throw new Error("unused"); },
      async changePassword() { throw new Error("unused"); },
      async requestPasswordReset() { return { delivery: null }; },
      async cancelPasswordReset() { return { revoked: true }; },
      async resetPassword() { return { userId: "user-1", email: "staff@pino.invalid" }; },
      async logout() { return { revoked: true }; },
    },
    PINO_STAFF_PASSWORD_EMAIL: { async send() { return {}; } },
    STAFF_PASSWORD_RESET_FROM_EMAIL: "no-reply@pinohouse.art",
    ...overrides,
  } as StaffPasswordRecoveryEnv;
}
test("known and unknown email requests return the same public accepted response without token disclosure", async () => {
  const unknown = await handleForgotPassword(
    request("/api/staff-auth/forgot-password", { email: "unknown@pino.invalid" }),
    makeEnv(),
  );

  const sent: Array<{ from:string; to:string; subject:string; text:string; html?:string }> = [];
  const known = await handleForgotPassword(
    request("/api/staff-auth/forgot-password", { email: "staff@pino.invalid" }),
    makeEnv({
      PINO_STAFF_PASSWORD_CORE: {
        ...makeEnv().PINO_STAFF_PASSWORD_CORE,
        async requestPasswordReset() {
          return { delivery: { email: "staff@pino.invalid", token: rawToken, expiresAt: "2026-09-29T03:00:00.000Z" } };
        },
      },
      PINO_STAFF_PASSWORD_EMAIL: { async send(message) { sent.push(message); return {}; } },
    }),
  );

  assert.equal(unknown.status, 202);
  assert.equal(known.status, 202);
  const unknownBody = await unknown.text();
  const knownBody = await known.text();
  assert.equal(unknownBody, knownBody);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "staff@pino.invalid");
  assert.match(sent[0]?.text ?? "", /https:\/\/tos\.pinohouse\.art\/staff-password\/reset#token=/);
  assert.doesNotMatch(sent[0]?.text ?? "", /\?token=/);
  assert.doesNotMatch(knownBody, new RegExp(rawToken));
});
test("delivery failure revokes the issued challenge and returns a generic unavailable response", async () => {
  const cancelled: string[] = [];
  const response = await handleForgotPassword(
    request("/api/staff-auth/forgot-password", { email: "staff@pino.invalid" }),
    makeEnv({
      PINO_STAFF_PASSWORD_CORE: {
        ...makeEnv().PINO_STAFF_PASSWORD_CORE,
        async requestPasswordReset() {
          return { delivery: { email: "staff@pino.invalid", token: rawToken, expiresAt: "2026-09-29T03:00:00.000Z" } };
        },
        async cancelPasswordReset(input) {
          cancelled.push(input.token);
          return { revoked: true };
        },
      },
      PINO_STAFF_PASSWORD_EMAIL: { async send() { throw new Error("provider unavailable"); } },
    }),
  );
  const body = await response.text();
  assert.equal(response.status, 503);
  assert.deepEqual(cancelled, [rawToken]);
  assert.doesNotMatch(body, new RegExp(rawToken));
  assert.doesNotMatch(body, /staff@pino\.invalid/);
});

test("missing email runtime configuration fails before reset issuance", async () => {
  let requested = false;
  const env = makeEnv({
    PINO_STAFF_PASSWORD_CORE: {
      ...makeEnv().PINO_STAFF_PASSWORD_CORE,
      async requestPasswordReset() { requested = true; return { delivery: null }; },
    },
    PINO_STAFF_PASSWORD_EMAIL: undefined,
  });
  const response = await handleForgotPassword(
    request("/api/staff-auth/forgot-password", { email: "staff@pino.invalid" }),
    env,
  );
  assert.equal(response.status, 503);
  assert.equal(requested, false);
});
test("reset forwards an opaque token and new password only to the Core binding", async () => {
  const seen: Array<{token:string;password:string}> = [];
  const env = makeEnv({
    PINO_STAFF_PASSWORD_CORE: {
      ...makeEnv().PINO_STAFF_PASSWORD_CORE,
      async resetPassword(input) {
        seen.push(input);
        return { userId: "user-1", email: "staff@pino.invalid" };
      },
    },
  });
  const response = await handleResetPassword(
    request("/api/staff-auth/reset-password", { token: rawToken, password: "new-password-value" }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(seen, [{ token: rawToken, password: "new-password-value" }]);
  assert.doesNotMatch(await response.text(), new RegExp(rawToken));
});

test("invalid or rejected reset tokens stay generic and never expose secret material", async () => {
  let calls = 0;
  const invalid = await handleResetPassword(
    request("/api/staff-auth/reset-password", { token: "short", password: "new-password-value" }),
    makeEnv({
      PINO_STAFF_PASSWORD_CORE: {
        ...makeEnv().PINO_STAFF_PASSWORD_CORE,
        async resetPassword() { calls += 1; throw new Error("should not run"); },
      },
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);

  const rejected = await handleResetPassword(
    request("/api/staff-auth/reset-password", { token: rawToken, password: "new-password-value" }),
    makeEnv({
      PINO_STAFF_PASSWORD_CORE: {
        ...makeEnv().PINO_STAFF_PASSWORD_CORE,
        async resetPassword() { throw new Error(`secret:${rawToken}`); },
      },
    }),
  );
  const body = await rejected.text();
  assert.equal(rejected.status, 400);
  assert.doesNotMatch(body, new RegExp(rawToken));
});
