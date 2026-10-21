import {assetStatusFromEvidence,type AssetEvidence} from "./pap659-asset-observation";
import type {RuntimeObservationFacts} from "./pap659-runtime-observation-client";
/** Never synthesize a build receipt or claim READY from absence of failures. */
export function observedRuntimeFacts(input:Readonly<{buildDigest:string|null;appliedConfigRevision:number|null;assetEvidence:AssetEvidence}>):RuntimeObservationFacts|null{
  if(!input.buildDigest||!Number.isSafeInteger(input.appliedConfigRevision)||input.appliedConfigRevision===null||input.appliedConfigRevision<1)return null;
  if(!/^[0-9a-f]{64}$/.test(input.buildDigest))return null;
  return {buildDigest:input.buildDigest,appliedConfigRevision:input.appliedConfigRevision,assetStatus:assetStatusFromEvidence(input.assetEvidence)};
}
