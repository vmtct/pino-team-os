import assert from "node:assert/strict";
import {test} from "node:test";
import {makeRuntimeObservation,sendRuntimeObservation} from "./pap659-runtime-observation-client";
const identity={sessionId:"display_runtime_session_12345678",displayId:"display_definition_12345678",deviceId:"display_device_12345678"};
const published={buildDigest:"a".repeat(64),configSource:"PUBLISHED" as const,appliedConfigRevision:1,assetStatus:"READY" as const};
const fallback={...published,configSource:"FALLBACK" as const,appliedConfigRevision:0 as const};
test("no authoritative facts or forged source/revision means no observation",()=>{
  assert.equal(makeRuntimeObservation(identity,null),null);
  assert.equal(makeRuntimeObservation({...identity,deviceId:null},published),null);
  assert.equal(makeRuntimeObservation({...identity,sessionId:"session"},published),null);
  assert.equal(makeRuntimeObservation({...identity,displayId:"display"},published),null);
  assert.equal(makeRuntimeObservation(identity,{...published,buildDigest:"A".repeat(64)}),null);
  assert.equal(makeRuntimeObservation(identity,{...published,appliedConfigRevision:0}),null);
  assert.equal(makeRuntimeObservation(identity,{...fallback,appliedConfigRevision:2} as unknown as typeof fallback),null);
});
test("published v1 unchanged and truthful fallback v2 explicit; never renderer ACK",()=>{
  assert.deepEqual(makeRuntimeObservation(identity,published),{version:1,...identity,buildDigest:published.buildDigest,appliedConfigRevision:1,assetStatus:"READY"});
  assert.deepEqual(makeRuntimeObservation(identity,fallback),{version:2,...identity,buildDigest:fallback.buildDigest,appliedConfigRevision:0,assetStatus:"READY",configSource:"FALLBACK"});
});
test("PAP-1325 accepts real Core UUID identities for v1 and v2 without forged reports",async()=>{
  const runtimeIdentity={sessionId:"01a19727-a5d1-75fe-9306-a10bafb57017",displayId:"01a18fcf-86ac-78f1-92d6-f170803a4125",deviceId:"019d9880-1025-7000-8000-000000000071"};
  const v1=makeRuntimeObservation(runtimeIdentity,published),v2=makeRuntimeObservation(runtimeIdentity,fallback);
  assert.deepEqual(v1,{version:1,...runtimeIdentity,buildDigest:published.buildDigest,appliedConfigRevision:1,assetStatus:"READY"});
  assert.deepEqual(v2,{version:2,...runtimeIdentity,buildDigest:fallback.buildDigest,appliedConfigRevision:0,assetStatus:"READY",configSource:"FALLBACK"});
  const success=async()=>Response.json({data:{valid:true,persisted:true,rendererAcknowledged:false}});
  assert.equal(await sendRuntimeObservation("/api/runtime",v2,success as typeof fetch),true);
  for(const bad of ["01a19727-a5d1-75fe-9306-a10bafb5701","01a19727-a5d1-75fe-9306-a10bafb5701g","01a19727a5d175fe9306a10bafb57017","forged"]){
    assert.equal(makeRuntimeObservation({...runtimeIdentity,sessionId:bad},fallback),null);
    assert.equal(makeRuntimeObservation({...runtimeIdentity,displayId:bad},published),null);
  }
  assert.equal(makeRuntimeObservation({...runtimeIdentity,deviceId:"invalid"},fallback),null);
});
test("reject malformed reports and forged acknowledgements before network",async()=>{
  let calls=0;
  const deny=async()=>{calls++;return new Response(null,{status:403});};
  const valid=makeRuntimeObservation(identity,fallback);
  assert.equal(await sendRuntimeObservation("/api/runtime",null,deny as typeof fetch),false);
  for(const bad of [
    {...(valid as object),rendererAcknowledged:true},
    {...(valid as object),configSource:"PUBLISHED"},
    {...(valid as object),appliedConfigRevision:3},
    {...(valid as object),deviceId:"forged"},
    {version:1,sessionId:"s"},
  ])assert.equal(await sendRuntimeObservation("/api/runtime",bad,deny as typeof fetch),false);
  assert.equal(calls,0);
  assert.equal(await sendRuntimeObservation("/api/runtime",valid,deny as typeof fetch),false);
  assert.equal(calls,1);
  const success=async()=>Response.json({data:{valid:true,persisted:true,rendererAcknowledged:false}});
  const fake=async()=>Response.json({data:{valid:true,persisted:true,rendererAcknowledged:true}});
  assert.equal(await sendRuntimeObservation("/api/runtime",valid,success as typeof fetch),true);
  assert.equal(await sendRuntimeObservation("/api/runtime",valid,fake as typeof fetch),false);
});
