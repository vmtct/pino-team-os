import type { WalkinPath } from "./open-studio-walkin-bo-api";
export const WALKIN_PATHS: readonly WalkinPath[] = ["AC","LPP","LPA","PH"];
export function assignmentReady(parentId:string,path:string,centerId:string,busy:boolean):boolean {
 return !busy&&!!parentId.trim()&&!!centerId.trim()&&WALKIN_PATHS.some(item=>item===path);
}

/** Never operate on a stale selected Pass after changing the active Center. */
export function selectedPassMatchesCenter(pass:{center_id:string|null}|null,centerId:string):boolean {
 return !!pass && !!centerId.trim() && pass.center_id===centerId;
}
/** A shared e-pass code is only valid while it is ASSIGNED to this Center. */
export function canCopyAssignedPassCode(pass:{center_id:string|null;status:string}|null,centerId:string):boolean {
 return selectedPassMatchesCenter(pass,centerId) && pass?.status==="ASSIGNED";
}
/** Async readbacks from an earlier Center/refresh must not overwrite the current inventory. */
export function acceptInventoryResponse(requestEpoch:number,currentEpoch:number,requestedCenter:string,activeCenter:string):boolean {
 return requestEpoch===currentEpoch && !!requestedCenter && requestedCenter===activeCenter;
}
