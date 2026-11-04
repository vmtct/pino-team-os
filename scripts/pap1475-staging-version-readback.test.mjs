// PAP-1475 / Epic PAP-184: deterministic metadata propagation/fail-closed tests.
import test from "node:test";
import assert from "node:assert/strict";
import { waitForWorkerVersion } from "./pap1475-staging-version-readback.mjs";

const version="73b19baf-b96f-4472-a1eb-9cefc92869f6";
const right={success:true,result:{id:version,resources:{bindings:[{name:"APP_ENV",text:"staging",type:"plain_text"}]}}};
const sequence=(...arr)=>{let i=0;return async()=>arr[Math.min(i++,arr.length-1)]};

test("PAP-1475: exactly deployed version metadata appears after transient 404",async()=>{
 let delays=0;
 const receipt=await waitForWorkerVersion({
  read:sequence({status:404},{status:404},{status:200,body:right}),
  expectedVersion:version,attempts:5,delay:async()=>{delays++;},
 });
 assert.equal(receipt.attempt,3);assert.equal(delays,2);assert.deepEqual(receipt.body,right);
});
test("PAP-1475: permanent 404 fails closed without metadata receipt",async()=>{
 await assert.rejects(waitForWorkerVersion({read:sequence({status:404}),expectedVersion:version,attempts:3}),/STAGING_CD_VERSION_METADATA_404_HOLD/);
});
test("PAP-1475: 401 and 403 are not retried as propagation",async()=>{
 for(const code of [401,403]){
  let calls=0;
  await assert.rejects(waitForWorkerVersion({read:async()=>{calls++;return {status:code};},expectedVersion:version,attempts:5}),new RegExp("STAGING_CD_VERSION_METADATA_HTTP_"+code));
  assert.equal(calls,1);
 }
});
test("PAP-1475: 500 and 429 are immediate failure, not blind retries",async()=>{
 for(const code of [500,429])await assert.rejects(
   waitForWorkerVersion({read:sequence({status:code},{status:200,body:right}),expectedVersion:version,attempts:5}),
   new RegExp("STAGING_CD_VERSION_METADATA_HTTP_"+code));
});
test("PAP-1475: incorrect version cannot be accepted even with HTTP 200",async()=>{
 await assert.rejects(waitForWorkerVersion({read:sequence({status:200,body:{...right,result:{...right.result,id:"0c0296e5-27e9-4746-8a71-e2d780ba2e2d"}}}),expectedVersion:version}),/STAGING_CD_VERSION_METADATA_MISMATCH/);
});
test("PAP-1475: malformed metadata or missing bindings never PASS",async()=>{
 for(const body of [{success:false}, {success:true,result:{id:version}}, {success:true,result:{id:version,resources:{bindings:[]}}}]){
  await assert.rejects(waitForWorkerVersion({read:sequence({status:200,body}),expectedVersion:version}),/STAGING_CD_VERSION_METADATA_MISMATCH/);
 }
});
test("PAP-1475: failed network does not create receipt",async()=>{
 await assert.rejects(waitForWorkerVersion({read:async()=>{throw Error("network lost");},expectedVersion:version}),/network lost/);
});
test("PAP-1475: invalid version or excessive polling rejects before request",async()=>{
 let calls=0;const read=async()=>{calls++;return {status:200,body:right};};
 await assert.rejects(waitForWorkerVersion({read,expectedVersion:"forged"}),/PAP1475_INVALID_VERSION_READBACK_ARGS/);
 await assert.rejects(waitForWorkerVersion({read,expectedVersion:version,attempts:100}),/PAP1475_INVALID_VERSION_READBACK_ARGS/);
 assert.equal(calls,0);
});
