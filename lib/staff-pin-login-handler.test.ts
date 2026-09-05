import test from "node:test";
import assert from "node:assert/strict";
import { handleStaffPinLogin, type StaffPinLoginEnv } from "./staff-pin-login-handler";

function env(onLogin?: StaffPinLoginEnv["PINO_STAFF_PIN_CORE"]["login"]): StaffPinLoginEnv {
  return {
    PINO_STAFF_PIN_CORE: {
      login: onLogin ?? (async () => ({ status: 200, body: { data: { token: "opaque-session" } }, requestId: "pin-login" })),
      statusWithStaffPassword: async () => ({ status: 200, body: {}, requestId: "status" }),
      configureWithStaffPassword: async () => ({ status: 200, body: {}, requestId: "configure" }),
      rotateWithStaffPassword: async () => ({ status: 200, body: {}, requestId: "rotate" }),
      logout: async () => ({ status: 204, body: null, requestId: "logout" }),
    },
  };
}

test("shared-device PIN login uses caller-supplied normalized Staff email without external IdP", async () => {
  let seen: { loginIdentifier: string; pin: string } | null = null;
  const response = await handleStaffPinLogin(new Request("https://tos.pinohouse.art/api/staff-pin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "  STAFF@PINO.INVALID ", pin: "123456" }),
  }), env(async input => {
    seen = input;
    return { status: 200, body: { data: { token: "shared-device-token" } }, requestId: "req-greenfield" };
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(seen, { loginIdentifier: "staff@pino.invalid", pin: "123456" });
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /pino_staff_session=shared-device-token/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, /pino_staff_password_session/);
});

test("shared-device PIN login requires Staff email", async () => {
  let called = false;
  const response = await handleStaffPinLogin(new Request("https://tos.pinohouse.art/api/staff-pin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: "123456" }),
  }), env(async () => {
    called = true;
    return { status: 200, body: {}, requestId: "unexpected" };
  }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});
