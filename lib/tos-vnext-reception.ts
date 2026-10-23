import type {Assignment} from "./workforce-api";
/** PAP-942 pure selector. A reception shift is only the authenticated own schedule. */
export function ownReceptionAssignments(assignments:readonly Assignment[],centerId:string,workDate:string){
 return assignments.filter(a=>a.centerId===centerId&&a.workDate===workDate&&
  a.status!=="CANCELLED"&&a.roleAssignments?.some(r=>r.roleType==="FRONT_DESK"&&
   r.targetType==="CENTER"&&r.targetId===centerId));
}
export const RECEPTION_VNEXT_WRITE_ADMITTED=false;
/** Never turn a visit read into a pickup authorization signal. */
export function pickupRequiresCoreVerification(){
 return !RECEPTION_VNEXT_WRITE_ADMITTED;
}
