/**
 * PAP-945 / PAP-727: Session-free Classroom Today and observation-only Diary.
 * Core PR #1930 is merged/deployed; this branch still needs a verified authenticated
 * Classroom writer and private R2 E2E before any client mutation may be admitted.
 * Mission Result/Progression are independent Core writers (PAP-1188).
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
 centerId?:string;runningClassId?:string|null;registeredAt?:string;registeredByUserId?:string;
 draftSavedAt?:string|null;draftSavedByUserId?:string|null;
 closedAt?:string|null;closedByUserId?:string|null;updatedAt?:string;
}
export class V18bCoreError extends Error{
 constructor(readonly status:number,readonly code:string,message:string){
  super(message);this.name="V18bCoreError";
 }
}
// Do not toggle from Core CI alone. Requires authenticated TOS Classroom writer + R2 proof.
export const V18B_WRITE_ADMITTED=false;
const base="/api/tos-learning";
type CoreEnvelope<T>={data?:T;error?:{code?:string;message?:string}};
async function parseResponse<T>(response:Response):Promise<T>{
 const body=await response.json().catch(()=>null) as CoreEnvelope<T>|null;
 if(!response.ok||body?.data===undefined)
  throw new V18bCoreError(response.status,body?.error?.code??"V18B_CORE_UNAVAILABLE",
   body?.error?.message??"Classroom V18b Core chưa sẵn sàng.");
 return body.data;
}
async function read<T>(path:string):Promise<T>{
 return parseResponse<T>(await fetch(base+path,{method:"GET",cache:"no-store"}));
}
const requireValue=(value:string,name:string)=>{
 if(typeof value!=="string"||!value.trim())throw new V18bCoreError(400,"MISSING_"+name,"Thiếu "+name);
 return encodeURIComponent(value.trim());
};
async function post<T>(path:string,input:object,idempotencyKey:string):Promise<T>{
 if(!V18B_WRITE_ADMITTED)
  throw new V18bCoreError(503,"CORE_V18B_WRITE_NOT_ADMITTED",
   "TOS Diary writer và private R2 chưa được nghiệm thu trên Staging.");
 const key=requireValue(idempotencyKey,"IDEMPOTENCY_KEY");
 return parseResponse<T>(await fetch(base+path,{
  method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json","Idempotency-Key":decodeURIComponent(key)},
  body:JSON.stringify(input),
 }));
}
export const tosClassroomV18bApi={
 today:(centerId:string,localDate:string)=>{
  const center=requireValue(centerId,"CENTER");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)||!Number.isFinite(Date.parse(localDate+"T12:00:00Z"))||new Date(localDate+"T12:00:00Z").toISOString().slice(0,10)!==localDate)throw new V18bCoreError(400,"INVALID_DATE","Ngày lớp không hợp lệ.");
  return read<V18bClassroomToday>("/classroom/day?centerId="+center+"&localDate="+encodeURIComponent(localDate));
 },
 diary:(diaryId:string,centerId:string)=>read<V18bPathDiary>(
  "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"?centerId="+requireValue(centerId,"CENTER")),
 evidence:(diaryId:string,centerId:string)=>read<unknown>(
  "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/evidence?centerId="+requireValue(centerId,"CENTER")),
 // Observation-only register. NEVER send old mission child payload to the Diary Core writer.
 register:(input:{centerId:string;runningClassId:string;studentId:string;pathKey:string;teachingContextKey:string},
  idempotencyKey:string)=>post<V18bPathDiary>("/learning/path-diaries",input,idempotencyKey),
 // Core v4 accepts notes/interest independent of Mission outcomes.
 saveDraft:(diaryId:string,input:{centerId:string;expectedVersion:number;
  interest?:number|null;notes?:string|null;difficulty?:string|null},idempotencyKey:string)=>
  post<V18bPathDiary>("/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/draft",input,idempotencyKey),
 // Preserve an explicit 409 instead of silently writing old Mission-child outcomes.
 appendMission:async (_diaryId:string,_input:unknown,_idempotencyKey:string):Promise<never>=>{
  throw new V18bCoreError(409,"DIARY_MISSION_RESULT_WRITER_MOVED_TO_INDEPENDENT_CORE",
   "Mission Result phải được ghi qua Core Mission độc lập.");
 },
 uploadEvidence:(diaryId:string,input:{centerId:string;mimeType:"image/jpeg"|"image/png"|"image/webp";base64:string},
  idempotencyKey:string)=>post<unknown>(
  "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/evidence",input,idempotencyKey),
 close:(diaryId:string,input:{centerId:string;expectedVersion:number;interest:number;notes:string;difficulty?:string|null},
  idempotencyKey:string)=>post<V18bPathDiary>(
  "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/close",input,idempotencyKey),
};
