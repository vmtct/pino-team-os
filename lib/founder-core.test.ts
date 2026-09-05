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

test("Founder compatibility path forwards verified Cloudflare identity for canonical Core authorization", async () => {
  const {callFounderCore}=await import("./founder-core");
  let identitySeen:unknown;
  const binding:PinoCoreBinding={
    async execute(_request,identity){identitySeen=identity;return{status:200,body:{data:{}},requestId:"verified-founder"};},
    async executeWithStaffPassword(){throw new Error("unexpected password");},
  };
  const identity={provider:"cloudflare_access" as const,subject:"cf-founder",email:"founder@pino.invalid",issuer:"https://team.pino.invalid",audience:["founder-aud"],expiresAt:2_000_000_000};
  const result=await callFounderCore(binding,{method:"GET",path:"/running-classes"},identity);
  assert.equal(result.status,200);assert.deepEqual(identitySeen,identity);
});
