import assert from "node:assert/strict";
import {test} from "node:test";
import {makeRuntimeObservation,sendRuntimeObservation} from "./pap659-runtime-observation-client";
const identity={sessionId:"session",displayId:"display",deviceId:"device"};
const facts={buildDigest:"a".repeat(64),appliedConfigRevision:1,assetStatus:"READY" as const};
test("no authoritative facts means no observation",()=>{
  assert.equal(makeRuntimeObservation(identity,null),null);
  assert.equal(makeRuntimeObservation({...identity,deviceId:null},facts),null);
  assert.equal(makeRuntimeObservation(identity,{...facts,buildDigest:"A".repeat(64)}),null);
  assert.equal(makeRuntimeObservation(identity,{...facts,appliedConfigRevision:0}),null);
});
test("valid report contains only explicit fields; never renderer ACK",()=>{
  const report=makeRuntimeObservation(identity,facts);
  assert.deepEqual(report,{version:1,...identity,...facts});
  assert.equal(Object.hasOwn(report as object,"rendererAcknowledged"),false);
});
test("missing report makes no request; rejected response is not success",async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;return new Response(null,{status:403});};
  assert.equal(await sendRuntimeObservation("/api/runtime",null,fetcher as typeof fetch),false);
  assert.equal(calls,0);
  assert.equal(await sendRuntimeObservation("/api/runtime",makeRuntimeObservation(identity,facts),fetcher as typeof fetch),false);
  assert.equal(calls,1);
});
