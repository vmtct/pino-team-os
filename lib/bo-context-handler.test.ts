import test from "node:test";
import assert from "node:assert/strict";
import { handleBoContextRequest, type BoContextEnv } from "./bo-context-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

function request(authenticated = true, url = "https://bo.pinohouse.art/api/bo/context") {
  return new Request(url, { headers: authenticated ? { cookie: "pino_staff_password_session=local-session-token" } : {} });
}
function env(binding: BoAccessCoreBinding): BoContextEnv { return { PINO_BO_CORE: binding }; }
function bindingWith(operation: (request: BoAccessRequest, token: string) => Promise<{status:number;body:unknown;requestId:string}>): BoAccessCoreBinding {
  return {

    executeWithStaffPassword: operation,
  };
}

test("BO context forwards only GET context through local password Core path", async () => {
  let forwardedRequest: BoAccessRequest | undefined, forwardedToken = "";
  const response = await handleBoContextRequest(request(), env(bindingWith(async (coreRequest, token) => {
    forwardedRequest = coreRequest; forwardedToken = token;
    return { status: 200, body: { data: { userId: "canonical-user", email: "bo.user@example.com", staffMemberId: null, surface: "BO", entitled: true } }, requestId: "bo-request-id" };
  })));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "bo-request-id");
  assert.deepEqual(forwardedRequest, { method: "GET", path: "context" });
  assert.equal(forwardedToken, "local-session-token");
  assert.equal(Object.hasOwn(forwardedRequest ?? {}, "body"), false);
});

test("BO context fails before Core without local password session", async () => {
  let called = false;
  const response = await handleBoContextRequest(request(false), env(bindingWith(async () => { called = true; throw new Error("unexpected"); })));
  assert.equal(response.status, 401); assert.equal(called, false);
});

test("Core BO entitlement denial propagates without local fallback", async () => {
  const response = await handleBoContextRequest(request(), env(bindingWith(async () => ({ status: 403, body: { error: { code: "ACCESS_SURFACE_DENIED" } }, requestId: "denied-request-id" }))));
  assert.equal(response.status, 403); assert.equal(response.headers.get("x-request-id"), "denied-request-id");
});

test("the Team OS BO context facade exposes no feature operation", async () => {
  const paths: string[] = [];
  await handleBoContextRequest(request(), env(bindingWith(async coreRequest => { paths.push(`${coreRequest.method} ${coreRequest.path}`); return { status: 200, body: { data: { entitled: true } }, requestId: "request" }; })));
  assert.deepEqual(paths, ["GET context"]);
});

test("workers.dev staging bypass no longer substitutes a human BO identity", async () => {
  let called = false;
  const response = await handleBoContextRequest(request(false, "https://pino-team-os-staging.example.workers.dev/api/bo/context"), {
    ...env(bindingWith(async () => { called = true; throw new Error("unexpected"); })), });
  assert.equal(response.status, 401); assert.equal(called, false);
});

test("PAP-1426 BO context sends validated selected Center as resource, not as permission", async () => {
  const centerId="01912345-6789-7abc-8def-0123456789ab";
  const calls:BoAccessRequest[]=[];
  const response=await handleBoContextRequest(
    request(true,`https://bo.pinohouse.art/api/bo/context?centerId=${centerId}`),
    env(bindingWith(async coreRequest=>{
      calls.push(coreRequest);
      return{status:200,body:{data:{surface:"BO",entitled:true,permissionKeys:["student.profile.edit"],studentProfileEditAllowed:false}},requestId:"capability-check"};
    }))
  );
  assert.equal(response.status,200);
  assert.deepEqual(calls,[{method:"GET",path:"context",resource:{centerId}}]);
  assert.equal((await response.json() as {data:{studentProfileEditAllowed:boolean}}).data.studentProfileEditAllowed,false);
});
test("PAP-1426 BO context denies arbitrary, duplicate or malformed Center query before Core",async()=>{
  const centerId="01912345-6789-7abc-8def-0123456789ab";
  let calls=0;
  const fake=env(bindingWith(async ()=>{calls++;throw new Error("Unexpected Core call");}));
  for(const suffix of [
    "?userId=forged&staffMemberId=forged",
    "?centerId=","?centerId=bad",
    `?centerId=${centerId}&centerId=${centerId}`,
    `?centerId=${centerId}&grant=student.profile.edit`,
  ]){
    const result=await handleBoContextRequest(request(true,"https://bo.pinohouse.art/api/bo/context"+suffix),fake);
    assert.equal(result.status,400,suffix);
  }
  assert.equal(calls,0);
});
