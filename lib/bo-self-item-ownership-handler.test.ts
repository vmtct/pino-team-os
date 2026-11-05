import test from "node:test";
import assert from "node:assert/strict";
import { handleBoSelfItemRequest, isBoSelfItemPath, type BoSelfItemEnv } from "./bo-self-item-ownership-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const centerId = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const wrongCenter = "01a0c5e5-b4f6-7c76-a4b8-537748e72deb";
const selfId = "01a18140-10b8-70d3-ad6b-3e747a0cddea";
const itemId = "01a194f0-9bd0-7896-89a0-677a620e3ecd";
const prefix = "pinoria/selfs/";
const base = "https://bo.pinohouse.art/api/bo/";
const session = { cookie: "pino_staff_password_session=synthetic-local-token" };
const ctx = "?centerId=" + centerId;
const owned = prefix + selfId + "/items";
const catalog = prefix + selfId + "/catalog";
const grant = prefix + selfId + "/items/" + itemId + "/grant";
const revoke = prefix + selfId + "/items/" + itemId + "/revoke";
const env = (binding: BoAccessCoreBinding): BoSelfItemEnv => ({ PINO_BO_CORE: binding });
const core = (status = 200): { binding: BoAccessCoreBinding; seen: Array<{ request: BoAccessRequest; token: string }> } => {
  const seen: Array<{ request: BoAccessRequest; token: string }> = [];
  return { seen, binding: {
    async executeWithStaffPassword(request, token) {
      seen.push({ request, token });
      return { status, body: status === 200 ? { data: { selfId, selfVersion: 1, items: [] } } : { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "pap1300-request" };
    },
  } };
};
function req(path: string, opts: RequestInit = {}, query = ctx) {
  return new Request(base + path + query, { ...opts, headers: { ...session, ...(opts.headers as Record<string, string> || {}) } });
}
test("PAP-1300 strict API allowlist and method gates", async () => {
  const f = core();
  assert.equal(isBoSelfItemPath(owned), true);
  assert.equal(isBoSelfItemPath("pinoria/worlds"), false);
  for (const path of [prefix + selfId, prefix + selfId + "/items/" + itemId, prefix + selfId + "/items/" + itemId + "/delete"]) {
    assert.equal((await handleBoSelfItemRequest(req(path), env(f.binding), path)).status, 404);
  }
  assert.equal((await handleBoSelfItemRequest(req(owned, { method: "DELETE" }), env(f.binding), owned)).status, 405);
  assert.equal((await handleBoSelfItemRequest(req(grant, { method: "GET" }), env(f.binding), grant)).status, 405);
  assert.equal(f.seen.length, 0);
});
test("PAP-1300 GET forwards exactly canonical Self, selected Center and no forged principal", async () => {
  const f=core();
  for (const path of [owned,catalog]) {
    const result=await handleBoSelfItemRequest(req(path),env(f.binding),path);
    assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"no-store");
    assert.equal(result.headers.get("x-request-id"),"pap1300-request");
  }
  assert.deepEqual(f.seen,[
    { request: { method:"GET",path:owned,resource:{centerId} },token:"synthetic-local-token" },
    { request: { method:"GET",path:catalog,resource:{centerId} },token:"synthetic-local-token" },
  ]);
});
test("PAP-1300 query enforces one scoped Center and rejects forged query", async () => {
  const f=core();
  for(const query of ["", "?centerId=forged", ctx+"&userId=founder",ctx+"&centerId="+wrongCenter,ctx+"&role=founder"]) {
    assert.equal((await handleBoSelfItemRequest(req(catalog,{},query),env(f.binding),catalog)).status,400);
  }
  assert.equal(f.seen.length,0);
});
test("PAP-1300 grant and revoke forward validated CAS and idempotency", async () => {
  const f=core();
  for(const path of [grant,revoke]) {
    const request=req(path,{method:"POST",headers:{ "content-type":"application/json","idempotency-key":"pap1300-unique-attempt" },body:JSON.stringify({expectedSelfVersion:2,reason:"E2E fixture"})});
    assert.equal((await handleBoSelfItemRequest(request,env(f.binding),path)).status,200);
  }
  assert.deepEqual(f.seen.map(x=>x.request),[grant,revoke].map(path=>({method:"POST",path,resource:{centerId},body:{expectedSelfVersion:2,reason:"E2E fixture"},idempotencyKey:"pap1300-unique-attempt"})));
});
test("PAP-1300 malformed commands fail before Core", async () => {
  const f=core();
  const bodies=[{expectedSelfVersion:0,reason:"Valid"},{expectedSelfVersion:1,reason:""},{expectedSelfVersion:1,reason:"valid",actor:"founder"},{expectedSelfVersion:1,reason:"a".repeat(1001)}];
  for(const body of bodies) {
    const r=req(grant,{method:"POST",headers:{"content-type":"application/json","idempotency-key":"pap1300-attempt"},body:JSON.stringify(body)});
    assert.equal((await handleBoSelfItemRequest(r,env(f.binding),grant)).status,400);
  }
  for(const key of ["","short"]) {
    const r=req(revoke,{method:"POST",headers:{"content-type":"application/json",...(key?{"idempotency-key":key}:{})},body:JSON.stringify({expectedSelfVersion:1,reason:"Valid"})});
    assert.equal((await handleBoSelfItemRequest(r,env(f.binding),revoke)).status,400);
  }
  assert.equal(f.seen.length,0);
});
test("PAP-1300 unauthenticated BO denied; Core 403/409 remains authoritative", async()=>{
  const f=core(403);
  const unauthorized=new Request(base+owned+ctx);
  assert.equal((await handleBoSelfItemRequest(unauthorized,env(f.binding),owned)).status,401);
  assert.equal(f.seen.length,0);
  const forbidden=await handleBoSelfItemRequest(req(owned),env(f.binding),owned);
  assert.equal(forbidden.status,403);
  assert.equal((await forbidden.json() as {error:{code:string}}).error.code,"ACCESS_PERMISSION_DENIED");
  const cas=core(409);
  const response=await handleBoSelfItemRequest(req(revoke,{method:"POST",headers:{"content-type":"application/json","idempotency-key":"pap1300-unique-attempt"},body:JSON.stringify({expectedSelfVersion:1,reason:"Revoke"})}),env(cas.binding),revoke);
  assert.equal(response.status,409);
});

test("PAP-1300 BO host catch-all dispatches every verb through the narrow facade before generic API", async () => {
  const { readFileSync } = await import("node:fs");
  const source=readFileSync(new URL("../app/api/bo/[...path]/route.ts",import.meta.url),"utf8");
  assert.match(source,/import \{ handleBoSelfItemRequest, isBoSelfItemPath/);
  assert.equal((source.match(/if \(isBoSelfItemPath\(joined\)\) return handleBoSelfItemRequest\(request, env, joined\);/g)||[]).length,5);
});
