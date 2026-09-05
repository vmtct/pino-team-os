import assert from "node:assert/strict";
import test from "node:test";
import { callWorkforceCoreWithStaffPassword, callWorkforceCoreWithStaffPin, type WorkforceCoreBinding } from "./workforce-core";

test("Workforce password flow forwards token and trusted transport", async () => {
  let seen = "", ip = "";
  const binding: WorkforceCoreBinding = {
    async executeWithStaffPassword(request, token, transport) { seen = token; ip = transport?.serverObservedIp ?? ""; return { status: 200, body: { data: request.body }, requestId: "password" }; },
    async executeWithStaffPin() { throw new Error("unexpected"); },
  };
  const response = await callWorkforceCoreWithStaffPassword(binding, { method: "GET", path: "/profile", body: { x: 1 } }, "pw-session", { serverObservedIp: "203.0.113.90" });
  assert.equal(response.status, 200); assert.equal(seen, "pw-session"); assert.equal(ip, "203.0.113.90");
});

test("Workforce PIN flow remains explicit", async () => {
  let seen = "";
  const binding: WorkforceCoreBinding = {
    async executeWithStaffPassword() { throw new Error("unexpected"); },
    async executeWithStaffPin(_request, token) { seen = token; return { status: 200, body: { data: {} }, requestId: "pin" }; },
  };
  assert.equal((await callWorkforceCoreWithStaffPin(binding, { method: "GET", path: "/context" }, "shared-device-session")).status, 200);
  assert.equal(seen, "shared-device-session");
});
