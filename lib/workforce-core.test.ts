import assert from "node:assert/strict";
import test from "node:test";
import { callWorkforceCoreWithStaffPassword, type WorkforceCoreBinding } from "./workforce-core";

test("Workforce password flow forwards token and trusted transport", async () => {
  let seen = "", ip = "";
  const binding: WorkforceCoreBinding = {
    async executeWithStaffPassword(request, token, transport) { seen = token; ip = transport?.serverObservedIp ?? ""; return { status: 200, body: { data: request.body }, requestId: "password" }; },
  };
  const response = await callWorkforceCoreWithStaffPassword(binding, { method: "GET", path: "/profile", body: { x: 1 } }, "pw-session", { serverObservedIp: "203.0.113.90" });
  assert.equal(response.status, 200); assert.equal(seen, "pw-session"); assert.equal(ip, "203.0.113.90");
});

test("Workforce binding has no Staff PIN execution surface", () => {
  const binding: WorkforceCoreBinding = {
    async executeWithStaffPassword() { return { status: 200, body: {}, requestId: "password" }; },
  };
  assert.equal("executeWithStaffPin" in binding, false);
});

test("Workforce compatibility credential dispatches verified Cloudflare identity to legacy Core execute", async () => {
  let subject="",ip="";
  const binding:WorkforceCoreBinding={
    async execute(_request,identity,transport){subject=identity.subject;ip=transport?.serverObservedIp??"";return{status:200,body:{data:{}},requestId:"legacy"};},
    async executeWithStaffPassword(){throw new Error("unexpected password");},
  };
  const {callWorkforceCoreWithCredential}=await import("./workforce-core");
  const response=await callWorkforceCoreWithCredential(binding,{method:"GET",path:"/context"},{kind:"cloudflare",identity:{provider:"cloudflare_access",subject:"cf-subject",email:"staff@pino.invalid",issuer:"https://team.pino.invalid",audience:["tos"],expiresAt:2_000_000_000}},{serverObservedIp:"203.0.113.91"});
  assert.equal(response.status,200);assert.equal(subject,"cf-subject");assert.equal(ip,"203.0.113.91");
});
