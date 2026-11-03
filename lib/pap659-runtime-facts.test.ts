import assert from "node:assert/strict";
import {test} from "node:test";
import {observedRuntimeFacts} from "./pap659-runtime-facts";
const empty={failedAssetIds:[]},digest="a".repeat(64);
test("no independent build digest or successful fallback read means no telemetry",()=>{
 assert.equal(observedRuntimeFacts({buildDigest:null,appliedConfigRevision:1,fallbackConfirmed:false,assetEvidence:empty}),null);
 assert.equal(observedRuntimeFacts({buildDigest:digest,appliedConfigRevision:null,fallbackConfirmed:false,assetEvidence:empty}),null);
 assert.equal(observedRuntimeFacts({buildDigest:"a".repeat(40),appliedConfigRevision:1,fallbackConfirmed:false,assetEvidence:empty}),null);
});
test("published facts remain v1 eligible, fallback zero needs confirmed Core null",()=>{
 assert.deepEqual(observedRuntimeFacts({buildDigest:digest,appliedConfigRevision:2,fallbackConfirmed:false,assetEvidence:empty}),
  {buildDigest:digest,configSource:"PUBLISHED",appliedConfigRevision:2,assetStatus:"UNKNOWN"});
 assert.deepEqual(observedRuntimeFacts({buildDigest:digest,appliedConfigRevision:null,fallbackConfirmed:true,assetEvidence:empty}),
  {buildDigest:digest,configSource:"FALLBACK",appliedConfigRevision:0,assetStatus:"UNKNOWN"});
 assert.equal(observedRuntimeFacts({buildDigest:digest,appliedConfigRevision:0,fallbackConfirmed:true,assetEvidence:empty}),null);
 assert.equal(observedRuntimeFacts({buildDigest:digest,appliedConfigRevision:2,fallbackConfirmed:false,assetEvidence:{failedAssetIds:["scene-aura"]}})?.assetStatus,"DEGRADED");
});
