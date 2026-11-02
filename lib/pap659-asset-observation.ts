/** Runtime-local asset evidence. A failure proves DEGRADED; absence of failures never proves READY. */
export type AssetEvidence = Readonly<{failedAssetIds:readonly string[]}>;
export function recordAssetFailure(state:AssetEvidence, assetId:string):AssetEvidence {
  if(!assetId || assetId.length>256 || state.failedAssetIds.includes(assetId))return state;
  return {failedAssetIds:[...state.failedAssetIds,assetId].slice(-64)};
}
export function assetStatusFromEvidence(state:AssetEvidence):"DEGRADED"|"UNKNOWN" {
  return state.failedAssetIds.length>0?"DEGRADED":"UNKNOWN";
}
