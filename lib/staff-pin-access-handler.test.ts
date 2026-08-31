import test from "node:test";
import assert from "node:assert/strict";
import { handleStaffPinChange, handleStaffPinStatus, type StaffPinAccessEnv } from "./staff-pin-access-handler";

function env(overrides: Partial<StaffPinAccessEnv["PINO_STAFF_PIN_CORE"]> = {}): StaffPinAccessEnv {
  return {
    CF_ACCESS_TEAM_DOMAIN: "pino.cloudflareaccess.com",
    CF_ACCESS_TOS_AUD: "tos",
    CF_ACCESS_BO_AUD: "bo",
    PINORIA_TOS_STAGING_BYPASS: "enabled",
    PINORIA_STAGING_STAFF_EMAIL: "staff@pino.invalid",
    PINO_STAFF_PIN_CORE: {
      login: async () => ({ status: 200, body: {}, requestId: "login" }),
      status: async () => ({ status: 200, body: { data: { state: "ROTATION_REQUIRED" } }, requestId: "status" }),
      rotate: async () => ({ status: 200, body: { data: { state: "ACTIVE" } }, requestId: "rotate" }),
      logout: async () => ({ status: 200, body: {}, requestId: "logout" }),
      ...overrides,
    },
  };
}

test("Staff PIN status forwards only the Cloudflare/staging identity to Core", async () => {
  let seenEmail = "";
  let seenProvider = "";
  const response = await handleStaffPinStatus(new Request("https://team-preview.workers.dev/api/staff-pin/status"), env({
    status: async identity => { seenEmail = identity.email; seenProvider = identity.provider; return { status: 200, body: { data: { state: "ROTATION_REQUIRED" } }, requestId: "req-status" }; },
  }));
  assert.equal(response.status, 200);
  assert.equal(seenEmail, "staff@pino.invalid");
  assert.equal(seenProvider, "cloudflare_access");
  assert.equal(response.headers.get("x-request-id"), "req-status");
});

test("workers.dev Staff PIN APIs prefer the dedicated TOS fixture when BO staging is also enabled", async () => {
  let seenEmail = "";
  let seenSubject = "";
  const response = await handleStaffPinStatus(new Request("https://team-preview.workers.dev/api/staff-pin/status"), {
    ...env({ status: async identity => { seenEmail = identity.email; seenSubject = identity.subject; return { status: 200, body: { data: { state: "ROTATION_REQUIRED" } }, requestId: "tos-principal" }; } }),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "manager@pino.invalid",
  });
  assert.equal(response.status, 200);
  assert.equal(seenEmail, "staff@pino.invalid");
  assert.equal(seenSubject, "pinoria-tos-staging-bypass-v1:staff@pino.invalid");
});

test("first-login PIN change requires current bootstrap PIN and forwards the new PIN to Core", async () => {
  let seenEmail = "";
  let seenCurrentPin = "";
  let seenPin = "";
  const response = await handleStaffPinChange(new Request("https://team-preview.workers.dev/api/staff-pin/change", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPin: "123456", pin: "654321" }),
  }), env({
    rotate: async (identity, input) => { seenEmail = identity.email; seenCurrentPin = input.currentPin; seenPin = input.pin; return { status: 200, body: { data: { state: "ACTIVE" } }, requestId: "req-rotate" }; },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual({ email: seenEmail, currentPin: seenCurrentPin, pin: seenPin }, { email: "staff@pino.invalid", currentPin: "123456", pin: "654321" });
  assert.equal(response.headers.get("x-request-id"), "req-rotate");
});

test("production Staff PIN status fails before Core without Cloudflare Access", async () => {
  let called = false;
  const response = await handleStaffPinStatus(new Request("https://tos.pinohouse.art/api/staff-pin/status"), env({
    status: async () => { called = true; return { status: 200, body: {}, requestId: "unexpected" }; },
  }));
  assert.equal(response.status, 401);
  assert.equal(called, false);
});
