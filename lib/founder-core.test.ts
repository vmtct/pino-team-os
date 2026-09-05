import test from "node:test";
import assert from "node:assert/strict";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";

test("Founder facade calls only local-password Core binding", async () => {
  let token = "";
  const binding: PinoCoreBinding = { async executeWithStaffPassword(request, value) {
    token = value;
    assert.equal(request.path, "/running-classes");
    return { status: 200, body: { data: [] }, requestId: "request" };
  } };
  const result = await callFounderCoreWithStaffPassword(binding, { method: "GET", path: "/running-classes" }, "founder-session");
  assert.equal(token, "founder-session");
  assert.equal(result.status, 200);
});
