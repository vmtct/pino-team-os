import type {Assignment} from "./workforce-api";
/** PAP-942 pure selector. A reception shift is only the authenticated own schedule. */
export function ownReceptionAssignments(assignments:readonly Assignment[],centerId:string,workDate:string){
 if(!centerId||!/^\d{4}-\d{2}-\d{2}$/.test(workDate))return [];
 const date=new Date(workDate+"T12:00:00Z");
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==workDate)return [];
 return assignments.filter(a=>a.centerId===centerId&&a.workDate===workDate&&
  a.status==="ACTIVE"&&a.roleAssignments?.some(r=>r.roleType==="FRONT_DESK"&&
   r.targetType==="CENTER"&&r.targetId===centerId));
}
export const RECEPTION_VNEXT_WRITE_ADMITTED=false;
/** Never turn a visit read into a pickup authorization signal. */
export function pickupRequiresCoreVerification(){
 return !RECEPTION_VNEXT_WRITE_ADMITTED;
}
