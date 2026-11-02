import test from "node:test";
import assert from "node:assert/strict";
import { handleBoPublicViewRequest } from "./bo-public-view-handler";

const id = "12345678-1234-4123-8123-123456789abc";
function harness(status=200) {
  const calls: Array<{request:unknown;token:string}> = [];
  const env = { PINO_BO_CORE: { executeWithStaffPassword: async (request:unknown, token:string) => {
    calls.push({request,token});
    return {status, body:status===409?{error:{code:"PLATFORM_CONFLICT"}}:status===403?{error:{code:"ACCESS_FORBIDDEN"}}:{data:[]},requestId:"bff-contract"};
  }}} as never;
  const send=(method:string,path:string,body?:unknown,authenticated=true)=>handleBoPublicViewRequest(new Request("https://bo.test/api/bo/"+path,{
    method, headers:{...(authenticated?{cookie:"pino_staff_password_session=fixture-session"}:{}),...(body!==undefined?{"content-type":"application/json"}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  }),env,path);
  return {calls,send};
}
test("unauthenticated BO view cannot invoke Core",async()=>{
  const h=harness(); const response=await h.send("GET","views/staff",undefined,false);
  assert.equal(response.status,401);assert.equal(h.calls.length,0);
});
test("write forwards authenticated body and preserves Core 409 conflict without retry",async()=>{
  const h=harness(409);const response=await h.send("PATCH",`views/staff/${id}`,{expectedVersion:2,name:"Changed"});
  assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:{code:"PLATFORM_CONFLICT"}});
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].token,"fixture-session");
  assert.deepEqual(h.calls[0].request,{path:`views/staff/${id}`,method:"PATCH",body:{expectedVersion:2,name:"Changed"}});
  assert.equal(response.headers.get("cache-control"),"no-store");
});
test("Core forbidden response remains 403",async()=>{
  const h=harness(403);const response=await h.send("POST","views/staff",{name:"Test"});
  assert.equal(response.status,403);assert.equal(h.calls.length,1);
});
test("bad route and body fail closed before Core",async()=>{
  const h=harness();assert.equal((await h.send("POST","views/../staff",{})).status,404);
  assert.equal((await h.send("POST","views/staff",[])).status,400);
  assert.equal((await h.send("POST","views/staff")).status,400);
  assert.equal(h.calls.length,0);
});