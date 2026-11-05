import test from "node:test";
import assert from "node:assert/strict";
import { allowedRequest, BO, HO, COLLECTION, FIXTURE_NAME, fixtureConfig, verifyFreezePersistence } from "./pap1105-freeze-g4-contract.mjs";
const id = "11111111-1111-4111-8111-111111111111";
function service({ existing = false, stripFreeze = false, ignoreCAS = false } = {}) {
  let stored = existing ? { id, moduleKey: "subscriptions", name: FIXTURE_NAME, version: 1, config: fixtureConfig("lifecycle") } : null;
  const calls = [];
  return { calls, get stored() { return structuredClone(stored); }, api: async (method, path, body) => {
    calls.push({ method, path, body: structuredClone(body) });
    if (method === "GET") return { status: 200, data: stored ? [structuredClone(stored)] : [] };
    if (method === "POST") { stored = { id, moduleKey: "subscriptions", name: body.name, version: 1, config: body.config }; return { status: 201, data: structuredClone(stored) }; }
    if (!ignoreCAS && body.expectedVersion !== stored.version) return { status: 409 };
    const boundary = body.config.columns.frozenThrough;
    if (boundary !== undefined && boundary !== null && boundary !== "lifecycle") return { status: 400 };
    const config = structuredClone(body.config);
    if (boundary === undefined) config.columns.frozenThrough = stored.config.columns.frozenThrough;
    if (stripFreeze) delete config.columns.frozenThrough;
    stored = { ...stored, version: stored.version + 1, config };
    return { status: 200, data: structuredClone(stored) };
  } };
}
test("realistic storage contract exercises string, omission, null, CAS and negatives; retains fixture", async () => {
  const s = service(); const receipt = await verifyFreezePersistence(s.api);
  assert(receipt.created && receipt.retained && receipt.restored);
  assert.deepEqual(s.stored.config, fixtureConfig());
  assert.equal(s.calls.filter(c => c.method === "POST").length, 1);
  assert(s.calls.every(c => ["GET", "POST", "PATCH"].includes(c.method)));
});
test("existing owned fixture reused and its original boundary restored", async () => {
  const s = service({existing:true}); await verifyFreezePersistence(s.api);
  assert.equal(s.stored.config.columns.frozenThrough, "lifecycle");
  assert(!s.calls.some(c => c.method === "POST"));
});
test("metadata-stripping and stale-version acceptance cannot produce PASS", async () => {
  for (const options of [{stripFreeze:true}, {ignoreCAS:true}]) await assert.rejects(() => verifyFreezePersistence(service(options).api));
});
test("duplicate or foreign-shaped fixture rejected before writes", async () => {
  for (const data of [[service({existing:true}).stored, service({existing:true}).stored],
    [{...service({existing:true}).stored, config:{...fixtureConfig(), search:"somebody else's view"}}]]) {
    let writes = 0;
    await assert.rejects(() => verifyFreezePersistence(async method => { if(method !== "GET") writes++; return {status:200,data}; }));
    assert.equal(writes, 0);
  }
});
test("request fence rejects Production, foreign hosts, token query, deletes and arbitrary bodies", () => {
  const body={expectedVersion:1,config:fixtureConfig()};
  const permit={method:"PATCH",path:COLLECTION+"/"+id,id,body};
  assert(allowedRequest(BO+permit.path,"PATCH",JSON.stringify(body),permit));
  assert(allowedRequest(HO+"/ho","GET",null,null));
  for(const [url,method,payload] of [
    [BO+permit.path,"DELETE",JSON.stringify(body)], [BO+permit.path+"?token=secret","PATCH",JSON.stringify(body)],
    ["https://bo.pinohouse.art"+permit.path,"PATCH",JSON.stringify(body)],
    ["https://evil.invalid"+permit.path,"GET",null],
    [BO+"/api/bo/subscriptions/"+id,"PATCH",JSON.stringify(body)],
    [BO+permit.path,"PATCH",JSON.stringify({...body,expectedVersion:2})],
  ]) assert.equal(allowedRequest(url,method,payload,permit),false);
  assert.equal(allowedRequest(BO+permit.path,"PATCH",JSON.stringify(body),null),false);
});

test("concurrent writer during restoration fails closed without CAS retry", async () => {
  const s=service(); let conflict=false,attempts=0;
  await assert.rejects(()=>verifyFreezePersistence(async(method,path,body)=>{
    if(method==="PATCH" && body.config.columns.frozenThrough===null && s.stored?.config.columns.frozenThrough===null){
      conflict=true;attempts++;return {status:409};
    }
    return s.api(method,path,body);
  }));
  assert(conflict);assert.equal(attempts,1);
});
test("inventory is emitted before mutations can fail and never includes configuration or actor data", async () => {
  const s=service({stripFreeze:true});const inventory=[];
  await assert.rejects(()=>verifyFreezePersistence(s.api,{onFixture:r=>inventory.push(r)}));
  assert.deepEqual(inventory,[{fixtureId:id,created:true,retained:true}]);
});

test("failed dependent case remains FAIL while independent acceptance cases still execute", async () => {
  const { recordFreezeCase } = await import("./pap1105-freeze-g4-contract.mjs");
  const cases=[];let independentRan=false;
  assert.equal(await recordFreezeCase(cases,"parent_probe",async()=>{throw new Error("secret body/PII");}),false);
  assert.equal(await recordFreezeCase(cases,"independent_persistence",async()=>{independentRan=true;}),true);
  assert(independentRan);assert.equal(cases.filter(c=>c.status==="FAIL").length,1);
  assert.equal(JSON.stringify(cases).includes("secret"),false);
});
test("Parent probe emits only bounded status/counts and explicit booleans", async () => {
  const { safeParentProbe } = await import("./pap1105-freeze-g4-contract.mjs");
  const result=safeParentProbe({status:403,total:"private",items:99999,index:1,selected:true,readGrant:true,
    table:1,rows:false,alert:true,loading:false,scopeMatches:false,recordId:"private",url:"token",body:{pii:true}});
  assert.deepEqual(result,{status:403,total:null,items:null,index:1,selected:true,readGrant:true,
    table:false,rows:false,alert:true,loading:false,scopeMatches:false});
});
