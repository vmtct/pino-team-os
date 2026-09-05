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

test("Founder compatibility path preserves the bounded legacy actor contract", async () => {
  const {callFounderCore}=await import("./founder-core");
  let subject="";
  const binding:PinoCoreBinding={
    async execute(_request,actor){subject=actor.subject;return{status:200,body:{data:{}},requestId:"legacy-founder"};},
    async executeWithStaffPassword(){throw new Error("unexpected password");},
  };
  const result=await callFounderCore(binding,{method:"GET",path:"/running-classes"},{actorType:"founder",subject:"cf-founder",email:"founder@pino.invalid"});
  assert.equal(result.status,200);assert.equal(subject,"cf-founder");
});
