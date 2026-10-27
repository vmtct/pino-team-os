/** PAP-1035 canonical Enrollment contracts. Core remains the authority. */
export interface BoEnrollmentRecord {
  id:string;
  subscriptionId:string;
  runningClassId:string;
  effectiveFromLocalDate:string;
  effectiveUntilExclusiveLocalDate:string|null;
  plannedEntryLocalTime:string|null;
  plannedDurationMinutes:number|null;
  predecessorEnrollmentId:string|null;
  seatContinuityKey:string;
  transitionKind:string|null;
  version:number;
  createdAt:string;
  updatedAt:string;
}
export interface BoEnrollmentPlacementState {
  subscriptionId:string;
  targetLocalDate:string;
  subscriptionLifecycle:string;
  placementState:"PENDING_PLACEMENT"|"PARTIALLY_PLACED"|"PLACED";
  effectiveEnrollmentCount:number;
  weeklySessionCommitment:number;
}
export interface BoEnrollmentCapacity {
  status:string;
  reason?:string;
  [key:string]:unknown;
}
export function enrollmentStatus(
  row:Pick<BoEnrollmentRecord,"effectiveFromLocalDate"|"effectiveUntilExclusiveLocalDate">,
  asOfLocalDate:string
):"UPCOMING"|"CURRENT"|"ENDED"{
  if(asOfLocalDate<row.effectiveFromLocalDate)return "UPCOMING";
  if(row.effectiveUntilExclusiveLocalDate!==null&&asOfLocalDate>=row.effectiveUntilExclusiveLocalDate)return "ENDED";
  return "CURRENT";
}
export function todayInHouseTimeZone(date=new Date()):string{
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const get=(type:string)=>parts.find(x=>x.type===type)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day");
}
export function validExclusiveEnd(start:string,end:string):boolean{
  return /^\d{4}-\d{2}-\d{2}$/.test(start)&&/^\d{4}-\d{2}-\d{2}$/.test(end)&&end>start;
}
export function isEligibleClass<T extends {pathProgramId:string;centerId?:string;status:string}>(
  cls:T,pathProgramId:string,centerId:string|undefined
):boolean{
  return cls.status==="ACTIVE"&&cls.pathProgramId===pathProgramId&&(!centerId||cls.centerId===centerId);
}
