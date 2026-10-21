import assert from "node:assert/strict";
import {test} from "node:test";
import {observedRuntimeFacts} from "./pap659-runtime-facts";
const empty={failedAssetIds:[]};
test("never emits telemetry without independently supplied build digest and applied revision",()=>{
 assert.equal(observedRuntimeFacts({buildDigest:null,appliedConfigRevision:1,assetEvidence:empty}),null);
 assert.equal(observedRuntimeFacts({buildDigest:"a".repeat(64),appliedConfigRevision:null,assetEvidence:empty}),null);
 assert.equal(observedRuntimeFacts({buildDigest:"a".repeat(40),appliedConfigRevision:1,assetEvidence:empty}),null);
});
test("renderer asset evidence never fabricates READY",()=>{
 const buildDigest="a".repeat(64);
 assert.deepEqual(observedRuntimeFacts({buildDigest,appliedConfigRevision:2,assetEvidence:empty}),{buildDigest,appliedConfigRevision:2,assetStatus:"UNKNOWN"});
 assert.equal(observedRuntimeFacts({buildDigest,appliedConfigRevision:2,assetEvidence:{failedAssetIds:["scene-aura"]}})?.assetStatus,"DEGRADED");
});
