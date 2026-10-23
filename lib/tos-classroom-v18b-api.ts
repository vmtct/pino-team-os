/**
 * PAP-945 / Core PAP-724: Session-free Classroom Today and V18b Path Diary.
 * Source-owned Core PR #1770 is still unmerged at this checkpoint.
 * All V18b writes must stay disabled until verified live Core + private R2.
 */
export interface V18bClassroomRosterMember{
 studentProfileId:string;studentDisplayName:string;status:"CANDIDATE"|"CONFLICT";
 planned:boolean;includedManually:boolean;inclusionId:string|null;
 expectedSources:Array<{kind:"ENROLLMENT"|"RENEWAL_GRACE";id:string;subscriptionId:string;enrollmentId:string}>;
}
export interface V18bClassroomOccurrence{
 teachingContextKey:string;runningClassId:string;operationalName:string;
 occurrence:{occurrenceKey:string;pathProgramId:string;localDate:string;status:string;
  localInterval:{startsAt:string;endsAt:string}|null};
 roster:V18bClassroomRosterMember[];
 rosterCoverage:"ENROLLMENTS_AND_GRACE_ONLY";
}
export interface V18bClassroomToday{
 centerId:string;localDate:string;timeZone:string;
 occurrences:V18bClassroomOccurrence[];
 suppressed:Array<{runningClassId:string;operationalName:string;teachingContextKey:string;status:string}>;
 diagnostics:string[];
}
export interface V18bPathDiary{
 id:string;studentId:string;teachingContextKey:string;pathKey:string;
 status:"REGISTERED"|"CLOSED";version:number;
 missions:Array<{id:string;missionId:string|null;code:string;name:string;completed:boolean|null;outcomeSavedVersion:number|null}>;
 interest:number|null;notes:string|null;difficulty:string|null;draftSavedVersion:number|null;
}
export class V18bCoreError extends Error{
 constructor(readonly status:number,readonly code:string,message:string){
  super(message);this.name="V18bCoreError";
 }
}
export const V18B_WRITE_ADMITTED=false;
const base="/api/tos-learning";
async function read<T>(path:string):Promise<T>{
 const response=await fetch(base+path,{method:"GET",cache:"no-store"});
 const body=await response.json().catch(()=>null) as {data?:T;error?:{code?:string;message?:string}}|null;
 if(!response.ok||body?.data===undefined)
  throw new V18bCoreError(response.status,body?.error?.code??"V18B_CORE_UNAVAILABLE",
   body?.error?.message??"Classroom V18b Core chưa sẵn sàng.");
 return body.data;
}
const requireValue=(value:string,name:string)=>{
 if(!value.trim())throw new V18bCoreError(400,"MISSING_"+name,"Thiếu "+name);
 return encodeURIComponent(value);
};
async function rejectWrite():Promise<never>{
 throw new V18bCoreError(503,"CORE_V18B_WRITE_NOT_ADMITTED",
  "Chưa thể ghi Path Diary khi Core PAP-724 và private evidence chưa được xác minh.");
}
export const tosClassroomV18bApi={
 today:(centerId:string,localDate:string)=>{
  const center=requireValue(centerId,"CENTER");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)||!Number.isFinite(Date.parse(localDate+"T12:00:00Z"))||new Date(localDate+"T12:00:00Z").toISOString().slice(0,10)!==localDate)throw new V18bCoreError(400,"INVALID_DATE","Ngày lớp không hợp lệ.");
  return read<V18bClassroomToday>("/classroom/day?centerId="+center+"&localDate="+encodeURIComponent(localDate));
 },
 diary:(diaryId:string,centerId:string)=>read<V18bPathDiary>(
  "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"?centerId="+requireValue(centerId,"CENTER")),
 // Source-confirmed payloads; writes remain locally rejected before any network call.
 register:(_input:{centerId:string;runningClassId:string;studentId:string;pathKey:string;teachingContextKey:string;
  mission:{missionId:string;code:string;name:string}},_idempotencyKey:string)=>rejectWrite(),
 saveDraft:(_diaryId:string,_input:{centerId:string;expectedVersion:number;outcomes:Record<string,boolean|null>;
  interest?:number|null;notes?:string|null;difficulty?:string|null},_idempotencyKey:string)=>rejectWrite(),
 appendMission:(_diaryId:string,_input:{centerId:string;expectedVersion:number;mission:{missionId:string;code:string;name:string}},_idempotencyKey:string)=>rejectWrite(),
 uploadEvidence:(_diaryId:string,_input:{centerId:string;mimeType:"image/jpeg"|"image/png"|"image/webp";base64:string},_idempotencyKey:string)=>rejectWrite(),
 close:(_diaryId:string,_input:{centerId:string;expectedVersion:number;interest:number;notes:string;difficulty?:string|null},_idempotencyKey:string)=>rejectWrite()
};
