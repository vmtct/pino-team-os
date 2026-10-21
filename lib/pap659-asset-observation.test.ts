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
