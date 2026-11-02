import {assetStatusFromEvidence,type AssetEvidence} from "./pap659-asset-observation";
import type {RuntimeObservationFacts} from "./pap659-runtime-observation-client";
/** Fallback is reportable only after a successful authenticated Core spatial
 * read explicitly returned null, not after a timeout or a missing revision.
 */
export function observedRuntimeFacts(input:Readonly<{
  buildDigest:string|null;appliedConfigRevision:number|null;
  fallbackConfirmed:boolean;assetEvidence:AssetEvidence;
}>):RuntimeObservationFacts|null {
  if(!input.buildDigest||!/^[0-9a-f]{64}$/.test(input.buildDigest))return null;
  const assetStatus=assetStatusFromEvidence(input.assetEvidence);
  if(Number.isSafeInteger(input.appliedConfigRevision) && input.appliedConfigRevision!==null && input.appliedConfigRevision>0)
    return {buildDigest:input.buildDigest,configSource:"PUBLISHED",appliedConfigRevision:input.appliedConfigRevision,assetStatus};
  if(input.appliedConfigRevision===null && input.fallbackConfirmed)
    return {buildDigest:input.buildDigest,configSource:"FALLBACK",appliedConfigRevision:0,assetStatus};
  return null;
}
