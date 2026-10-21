import test from "node:test";
import assert from "node:assert/strict";
import {releaseReceipt, smoke, probes} from "./release-confidence-smoke.mjs";

const sha="a".repeat(40),id="12345",version="11111111-1111-4111-8111-111111111111",deployment="22222222-2222-4222-8222-222222222222";
const pass={id:7,user:{login:"github-actions[bot]"},body:"TEAM_RUNTIME_PRODUCTION_RELEASE: **PASS**\n- Team source: "+sha+"\n- Workflow run: "+id+"\n- Team Worker version: "+version+"\n- Deployment ID: "+deployment+"\n- Traffic: 100%"};
test("PAP-867: attested immutable receipt required before any smoke",()=>{
  assert.equal(releaseReceipt([pass],id,sha)?.deploymentId,deployment);
  assert.equal(releaseReceipt([pass],id,"b".repeat(40)),null);
  assert.equal(releaseReceipt([{...pass,user:{login:"visitor"}}],id,sha),null);
  assert.equal(releaseReceipt([{...pass,body:pass.body.replace("100%","0%")}],id,sha),null);
});
test("PAP-867: unknown release emits NOT_RUN, never PASS",async()=>{
  const r=await smoke(async()=>{throw Error("must not make network request")},null);
  assert.equal(r.status,"NOT_RUN");
  assert.equal(r.authenticatedProductUat,"NOT_RUN");
});
test("PAP-867: route failure is detected without changing the deployed release",async()=>{
  const r=await smoke(async(url)=>({status:url.includes("instances")?404:url.includes("/bo/missions")?307:401,headers:new Headers({"location":"/staff-login"})}),{sourceSha:sha},probes);
  assert.equal(r.status,"FAIL");
  assert.ok(r.probes.some(p=>p.httpStatus===404&&p.status==="FAIL"));
});
test("PAP-867: successful read-only perimeter checks never imply Product UAT",async()=>{
 const statuses=[200,307,401,401,404,404];let i=0;
 const r=await smoke(async()=>({status:statuses[i++],headers:new Headers({"location":"/staff-login"})}),{sourceSha:sha});
 assert.equal(r.status,"PASS");
 assert.equal(r.authenticatedProductUat,"NOT_RUN");
});
