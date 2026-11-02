import assert from "node:assert/strict";
import {test} from "node:test";
import {assetStatusFromEvidence,recordAssetFailure} from "./pap659-asset-observation";
test("PAP-659 no asset failure is UNKNOWN, never guessed READY",()=>{
  assert.equal(assetStatusFromEvidence({failedAssetIds:[]}),"UNKNOWN");
});
test("PAP-659 actual asset failure degrades and deduplicates within runtime scope",()=>{
  const initial={failedAssetIds:[]};
  const observed=recordAssetFailure(initial,"arrival:companion:missing.png");
  assert.equal(assetStatusFromEvidence(observed),"DEGRADED");
  assert.equal(recordAssetFailure(observed,"arrival:companion:missing.png"),observed);
  assert.equal(assetStatusFromEvidence(initial),"UNKNOWN");
});
test("PAP-659 ignores invalid asset identifiers without mutation",()=>{
  const initial={failedAssetIds:[]};
  assert.equal(recordAssetFailure(initial,""),initial);
  assert.equal(recordAssetFailure(initial,"x".repeat(257)),initial);
});
test("PAP-659 bounds repeated failure evidence to 64 entries",()=>{
  let state:{readonly failedAssetIds:readonly string[]}={failedAssetIds:[]};
  for(let i=0;i<80;i++)state=recordAssetFailure(state,`asset-${i}`);
  assert.equal(state.failedAssetIds.length,64);
  assert.equal(state.failedAssetIds[0],"asset-16");
  assert.equal(state.failedAssetIds[63],"asset-79");
  assert.equal(assetStatusFromEvidence(state),"DEGRADED");
});
