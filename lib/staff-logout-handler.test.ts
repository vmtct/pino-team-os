import test from "node:test";
import assert from "node:assert/strict";
import { handleStaffLogout, type StaffLogoutEnv } from "./staff-logout-handler";

function env(
  onPasswordLogout?: StaffLogoutEnv["PINO_STAFF_PASSWORD_CORE"]["logout"],
  onPinLogout?: StaffLogoutEnv["PINO_STAFF_PIN_CORE"]["logout"],
): StaffLogoutEnv {
  return {
    PINO_STAFF_PASSWORD_CORE: {
      login: async () => ({ token: "password", expiresAt: "2099-01-01T00:00:00Z", userId: "user", staffMemberId: "staff", email: "staff@example.test" }),
      status: async () => ({ userId: "user", staffMemberId: "staff", email: "staff@example.test" }),
      logout: onPasswordLogout ?? (async () => ({ revoked: true })),
    },
    PINO_STAFF_PIN_CORE: {
      login: async () => ({ status: 200, body: {}, requestId: "login" }),
      statusWithStaffPassword: async () => ({ status: 200, body: {}, requestId: "status" }),
      configureWithStaffPassword: async () => ({ status: 200, body: {}, requestId: "configure" }),
      rotateWithStaffPassword: async () => ({ status: 200, body: {}, requestId: "rotate" }),
      logout: onPinLogout ?? (async () => ({ status: 204, body: null, requestId: "logout" })),
    },
  };
}

test("logout revokes both password and shared-device PIN sessions and clears both cookies", async () => {
  const revoked: string[] = [];
  const response = await handleStaffLogout(new Request("https://tos.pinohouse.art/api/staff-auth/logout", {
    method: "POST",
    headers: { cookie: "pino_staff_password_session=password-token; pino_staff_session=pin-token" },
  }), env(
    async token => { revoked.push(`password:${token}`); return { revoked: true }; },
    async token => { revoked.push(`pin:${token}`); return { status: 204, body: null, requestId: "pin-logout" }; },
  ));

  assert.equal(response.status, 200);
  assert.deepEqual(revoked.sort(), ["password:password-token", "pin:pin-token"]);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /pino_staff_password_session=;/);
  assert.match(setCookie, /pino_staff_session=;/);
  assert.equal((setCookie.match(/Max-Age=0/g) ?? []).length, 2);
});

test("logout remains locally effective when a Core revocation call fails", async () => {
  let pinRevoked = false;
  const response = await handleStaffLogout(new Request("https://tos.pinohouse.art/api/staff-auth/logout", {
    method: "POST",
    headers: { cookie: "pino_staff_password_session=password-token; pino_staff_session=pin-token" },
  }), env(
    async () => { throw new Error("password core unavailable"); },
    async () => { pinRevoked = true; return { status: 204, body: null, requestId: "pin-logout" }; },
  ));

  assert.equal(response.status, 200);
  assert.equal(pinRevoked, true);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /pino_staff_password_session=;/);
  assert.match(setCookie, /pino_staff_session=;/);
});
