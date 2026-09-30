import test from "node:test";
import assert from "node:assert/strict";
import { handleStaffLogout, type StaffLogoutEnv } from "./staff-logout-handler";

function env(onPasswordLogout?: StaffLogoutEnv["PINO_STAFF_PASSWORD_CORE"]["logout"]): StaffLogoutEnv {
  return {
    PINO_STAFF_PASSWORD_CORE: {
      login: async () => ({ token: "password", expiresAt: "2099-01-01T00:00:00Z", userId: "user", staffMemberId: "staff", email: "staff@example.test", passwordChangeRequired: false }),
      status: async () => ({ userId: "user", staffMemberId: "staff", email: "staff@example.test", passwordChangeRequired: false }),
      changePassword: async () => ({ token: "changed", expiresAt: "2099-01-01T00:00:00Z", userId: "user", staffMemberId: "staff", email: "staff@example.test", passwordChangeRequired: false }),
      logout: onPasswordLogout ?? (async () => ({ revoked: true })),
    },
  };
}

test("logout revokes the password session and expires password plus retired legacy PIN cookie", async () => {
  const revoked: string[] = [];
  const response = await handleStaffLogout(new Request("https://tos.pinohouse.art/api/staff-auth/logout", {
    method: "POST",
    headers: { cookie: "pino_staff_password_session=password-token; pino_staff_session=legacy-pin-token" },
  }), env(async token => { revoked.push(token); return { revoked: true }; }));

  assert.equal(response.status, 200);
  assert.deepEqual(revoked, ["password-token"]);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /pino_staff_password_session=;/);
  assert.match(setCookie, /pino_staff_session=;/);
  assert.equal((setCookie.match(/Max-Age=0/g) ?? []).length, 3);
});

test("logout remains locally effective when password Core revocation fails", async () => {
  const response = await handleStaffLogout(new Request("https://tos.pinohouse.art/api/staff-auth/logout", {
    method: "POST",
    headers: { cookie: "pino_staff_password_session=password-token; pino_staff_session=legacy-pin-token" },
  }), env(async () => { throw new Error("password core unavailable"); }));

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /pino_staff_password_session=;/);
  assert.match(setCookie, /pino_staff_session=;/);
});

test("logout revokes and clears support session alongside ordinary TOS sessions", async () => {
  const revoked: string[] = [];
  const base = env();
  base.PINO_STAFF_PASSWORD_CORE.supportLogout = async token => { revoked.push(token); return { revoked: true }; };
  const response = await handleStaffLogout(new Request("https://tos.pinohouse.art/api/staff-auth/logout", {
    method: "POST",
    headers: { cookie: "pino_support_session=support-token" },
  }), base);
  assert.deepEqual(revoked, ["support-token"]);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /pino_support_session=;/);
});
