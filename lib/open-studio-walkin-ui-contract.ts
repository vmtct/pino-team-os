import type { WalkinPath } from "./open-studio-walkin-bo-api";
export const WALKIN_PATHS: readonly WalkinPath[] = ["AC","LPP","LPA","PH"];
export function assignmentReady(parentId:string,path:string,centerId:string,busy:boolean):boolean {
 return !busy&&!!parentId.trim()&&!!centerId.trim()&&WALKIN_PATHS.some(item=>item===path);
}
