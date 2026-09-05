import test from "node:test";
import assert from "node:assert/strict";
import { handleStaffPinChange, handleStaffPinStatus, type StaffPinAccessEnv } from "./staff-pin-access-handler";

function env(overrides: Partial<StaffPinAccessEnv["PINO_STAFF_PIN_CORE"]> = {}): StaffPinAccessEnv {
  const binding: StaffPinAccessEnv["PINO_STAFF_PIN_CORE"] = {
    login: async () => ({ status: 200, body: {}, requestId: "login" }),
    logout: async () => ({ status: 204, body: null, requestId: "logout" }),
    statusWithStaffPassword: async () => ({ status: 200, body: { data: { state: "ACTIVE" } }, requestId: "status" }),
    configureWithStaffPassword: async () => ({ status: 200, body: { data: { state: "ACTIVE" } }, requestId: "configure" }),
    rotateWithStaffPassword: async () => ({ status: 200, body: { data: { state: "ACTIVE" } }, requestId: "rotate" }),
  };
  Object.assign(binding, overrides);
  return { PINO_STAFF_PIN_CORE: binding };
}
function request(path: string, body?: unknown) {
  return new Request(`https://tos.pinohouse.art/api/staff-pin/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie: "pino_staff_password_session=password-session", ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("Staff PIN status is resolved by local password session", async () => {
  let token = "";
  const response = await handleStaffPinStatus(request("status"), env({
    statusWithStaffPassword: async value => {
      token = value;
      return { status: 200, body: { data: { state: "ACTIVE" } }, requestId: "status-greenfield" };
    },
  }));
  assert.equal(response.status, 200);
  assert.equal(token, "password-session");
  assert.equal(response.headers.get("x-request-id"), "status-greenfield");
});

test("first PIN setup uses password session and no current PIN", async () => {
  let seen: { token: string; pin: string } | null = null;
  const response = await handleStaffPinChange(request("change", { pin: "135790" }), env({
    configureWithStaffPassword: async (token, input) => {
      seen = { token, pin: input.pin };
      return { status: 200, body: { data: { state: "ACTIVE" } }, requestId: "configure-greenfield" };
    },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(seen, { token: "password-session", pin: "135790" });
});

test("existing PIN change uses password session plus current PIN", async () => {
  let seen: { token: string; currentPin: string; pin: string } | null = null;
  const response = await handleStaffPinChange(request("change", { currentPin: "135790", pin: "246810" }), env({
    rotateWithStaffPassword: async (token, input) => {
      seen = { token, currentPin: input.currentPin, pin: input.pin };
      return { status: 200, body: { data: { state: "ACTIVE" } }, requestId: "rotate-greenfield" };
    },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(seen, { token: "password-session", currentPin: "135790", pin: "246810" });
});

test("Staff PIN management fails before Core without local password session", async () => {
  let called = false;
  const response = await handleStaffPinStatus(new Request("https://tos.pinohouse.art/api/staff-pin/status"), env({
    statusWithStaffPassword: async () => {
      called = true;
      return { status: 200, body: {}, requestId: "unexpected" };
    },
  }));
  assert.equal(response.status, 401);
  assert.equal(called, false);
});
