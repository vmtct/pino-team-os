/** PAP-945 / Epic PAP-727: typed, source-owned V18b classroom and Diary adapter.
 * Core stores an observation-only Diary; PAP-1254 links Missions independently.
 * PAP-1204 owns Mission Results. V18b runtime writes remain gated pending UI/E2E.
 */
export interface V18bClassroomRosterMember {
 studentProfileId:string;studentDisplayName:string;status:"CANDIDATE"|"CONFLICT";
 planned:boolean;includedManually:boolean;inclusionId:string|null;
 expectedSources:Array<{kind:"ENROLLMENT"|"RENEWAL_GRACE";id:string;subscriptionId:string;enrollmentId:string}>;
}
export interface V18bClassroomOccurrence {
 teachingContextKey:string;runningClassId:string;operationalName:string;
 occurrence:{occurrenceKey:string;pathProgramId:string;localDate:string;status:string;localInterval:{startsAt:string;endsAt:string}|null};
 roster:V18bClassroomRosterMember[];rosterCoverage:"ENROLLMENTS_AND_GRACE_ONLY";
}
export interface V18bClassroomToday {
 centerId:string;localDate:string;timeZone:string;occurrences:V18bClassroomOccurrence[];
 suppressed:Array<{runningClassId:string;operationalName:string;teachingContextKey:string;status:string}>;diagnostics:string[];
}
export interface V18bPathDiary {
 id:string;studentId:string;teachingContextKey:string;pathKey:string;
 status:"REGISTERED"|"CLOSED";version:number;
 interest:number|null;notes:string|null;difficulty:string|null;
 centerId?:string;runningClassId?:string|null;registeredAt?:string;registeredByUserId?:string;
 draftSavedAt?:string|null;draftSavedByUserId?:string|null;closedAt?:string|null;updatedAt?:string;
}
export interface V18bDiaryMissionLink {
 id:string;diaryId:string;missionId:string;missionCode:string;missionName:string;
 missionStatus:string;assignmentId:string|null;linkedAt:string;linkedByUserId:string;
}
/** Only a server-projected occurrence and actual roster can authorize these choices. */
export interface V18bEligibleMissionsInput {
 centerId:string;runningClassId:string;studentId:string;localDate:string;teachingContextKey:string;
 limit?:number;offset?:number;
}
export interface V18bEligibleMissionChoice {
 missionId:string;code:string;name:string;level:number;assignmentId:string|null;
}
export interface V18bEligibleMissionsRead {
 centerId:string;runningClassId:string;studentId:string;localDate:string;teachingContextKey:string;
 pathProgramId:string;items:V18bEligibleMissionChoice[];hasMore:boolean;
}
export class V18bCoreError extends Error {
 constructor(readonly status:number,readonly code:string,message:string){super(message);this.name="V18bCoreError";}
}
/** No production UI write until PAP-945 V18b form, authentic roster and PAP-1222 E2E acceptance. */
export const V18B_WRITE_ADMITTED=false;
type Envelope<T>={data?:T;error?:{code?:string;message?:string}};
const base="/api/tos-learning";
const requireValue=(value:string,name:string)=>{
 if(typeof value!=="string"||!value.trim())throw new V18bCoreError(400,"MISSING_"+name,"Thiếu "+name);
 return encodeURIComponent(value.trim());
};
const positiveVersion=(n:number)=>{
 if(!Number.isSafeInteger(n)||n<1)throw new V18bCoreError(400,"INVALID_VERSION","Phiên bản Nhật ký không hợp lệ.");
 return n;
};
function observationOnly(input:object):void {
 const fields=input as Record<string,unknown>;
 if(Object.prototype.hasOwnProperty.call(fields,"mission")||Object.prototype.hasOwnProperty.call(fields,"missions")||
    Object.prototype.hasOwnProperty.call(fields,"outcomes"))
  throw new V18bCoreError(409,"DIARY_MISSION_RESULT_WRITER_MOVED_TO_INDEPENDENT_CORE",
   "Mission Result không thuộc nguồn ghi Nhật ký.");
}
function validatedInterest(value:number|null|undefined) {
 if(value!==undefined&&value!==null&&(!Number.isInteger(value)||value<1||value>4))
  throw new V18bCoreError(400,"INVALID_INTEREST","Mức độ quan tâm phải từ 1 đến 4.");
}
async function responseData<T>(response:Response):Promise<T> {
 const body=await response.json().catch(()=>null) as Envelope<T>|null;
 if(!response.ok||body?.data===undefined)
  throw new V18bCoreError(response.status,body?.error?.code??"V18B_CORE_UNAVAILABLE",
   body?.error?.message??"Classroom V18b Core chưa sẵn sàng.");
 return body.data;
}
/** Separate transport construction permits offline contract tests; the UI singleton is always fail-closed. */
export function createV18bApiTransport(canWrite:boolean,transport:typeof fetch=(...args)=>fetch(...args)){
 const get=<T>(path:string)=>transport(base+path,{method:"GET",cache:"no-store"}).then(responseData<T>);
 async function post<T>(path:string,input:object,idempotencyKey:string):Promise<T> {
  if(!canWrite)throw new V18bCoreError(503,"CORE_V18B_WRITE_NOT_ADMITTED","TOS Nhật ký chưa nghiệm thu Staging.");
  const key=decodeURIComponent(requireValue(idempotencyKey,"IDEMPOTENCY_KEY"));
  return responseData<T>(await transport(base+path,{
   method:"POST",cache:"no-store",headers:{"content-type":"application/json","idempotency-key":key},
   body:JSON.stringify(input),
  }));
 }
 return {
  today:(centerId:string,localDate:string)=>{
   const center=requireValue(centerId,"CENTER");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)||!Number.isFinite(Date.parse(localDate+"T12:00:00Z"))||
      new Date(localDate+"T12:00:00Z").toISOString().slice(0,10)!==localDate)
    throw new V18bCoreError(400,"INVALID_DATE","Ngày lớp không hợp lệ.");
   return get<V18bClassroomToday>("/classroom/day?centerId="+center+"&localDate="+encodeURIComponent(localDate));
  },
  eligibleMissions:(input:V18bEligibleMissionsInput)=>{
   const centerId=input.centerId?.trim()??"",runningClassId=input.runningClassId?.trim()??"";
   const studentId=input.studentId?.trim()??"",localDate=input.localDate;
   const teachingContextKey=input.teachingContextKey?.trim()??"";
   for(const [name,value] of Object.entries({centerId,runningClassId,studentId,localDate,teachingContextKey}))
    if(!value||typeof value!=="string")
     throw new V18bCoreError(400,"MISSION_ELIGIBILITY_SCOPE_INVALID","Thiếu "+name+" của lớp học.");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)||
      !Number.isFinite(Date.parse(localDate+"T12:00:00Z"))||
      new Date(localDate+"T12:00:00Z").toISOString().slice(0,10)!==localDate||
      teachingContextKey!==runningClassId+":"+localDate)
    throw new V18bCoreError(400,"MISSION_ELIGIBILITY_SCOPE_INVALID","Ngữ cảnh lớp học không hợp lệ.");
   const limit=input.limit??50,offset=input.offset??0;
   if(!Number.isSafeInteger(limit)||limit<1||limit>100||
      !Number.isSafeInteger(offset)||offset<0||offset>10000)
    throw new V18bCoreError(400,"MISSION_ELIGIBILITY_PAGE_INVALID","Trang Mission không hợp lệ.");
   const query=new URLSearchParams({
    centerId,runningClassId,studentId,localDate,teachingContextKey,
    limit:String(limit),offset:String(offset),
   });
   return get<V18bEligibleMissionsRead>("/learning/missions/eligible?"+query.toString()).then(data=>{
    const rows=Array.isArray(data?.items)?data.items:[];
    const valid=Boolean(data&&data.centerId===centerId&&data.runningClassId===runningClassId
     &&data.studentId===studentId&&data.localDate===localDate
     &&data.teachingContextKey===teachingContextKey
     &&typeof data.pathProgramId==="string"&&data.pathProgramId
     &&typeof data.hasMore==="boolean"&&Array.isArray(data.items)
     &&rows.every(item=>item&&typeof item.missionId==="string"&&item.missionId.length>0
      &&typeof item.code==="string"&&item.code.length>0
      &&typeof item.name==="string"&&item.name.length>0
      &&Number.isFinite(item.level)
      &&(item.assignmentId===null||(typeof item.assignmentId==="string"&&item.assignmentId.length>0)))
     &&new Set(rows.map(item=>item.missionId)).size===rows.length);
    if(!valid)throw new V18bCoreError(502,"MISSION_ELIGIBILITY_READBACK_MISMATCH",
     "Core không trả danh sách Nhiệm vụ đúng Center, lớp học và học viên.");
    return data;
   });
  },
  diary:(diaryId:string,centerId:string)=>get<V18bPathDiary>(
   "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"?centerId="+requireValue(centerId,"CENTER")),
  evidence:(diaryId:string,centerId:string)=>get<unknown>(
   "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/evidence?centerId="+requireValue(centerId,"CENTER")),
  missionLinks:(diaryId:string,centerId:string)=>get<V18bDiaryMissionLink[]>(
   "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/mission-links?centerId="+requireValue(centerId,"CENTER")),
  register:(input:{centerId:string;runningClassId:string;studentId:string;pathKey:string;teachingContextKey:string},
   idempotencyKey:string)=>{
   observationOnly(input);
   for(const [name,value] of Object.entries(input))requireValue(value,name);
   return post<V18bPathDiary>("/learning/path-diaries",input,idempotencyKey);
  },
  saveDraft:(diaryId:string,input:{centerId:string;expectedVersion:number;interest?:number|null;notes?:string|null;difficulty?:string|null},
   idempotencyKey:string)=>{
   observationOnly(input);positiveVersion(input.expectedVersion);validatedInterest(input.interest);
   return post<V18bPathDiary>("/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/draft",input,idempotencyKey);
  },
  linkMission:(diaryId:string,input:{centerId:string;missionId:string;assignmentId?:string|null},idempotencyKey:string)=>{
   const body={centerId:input.centerId,missionId:input.missionId,...(input.assignmentId?{assignmentId:input.assignmentId}:{})};
   requireValue(body.centerId,"CENTER");requireValue(body.missionId,"MISSION");
   if(input.assignmentId!=null)requireValue(input.assignmentId,"ASSIGNMENT");
   return post<V18bDiaryMissionLink>("/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/mission-links",body,idempotencyKey);
  },
  appendMission:async():Promise<never>=>{
   throw new V18bCoreError(409,"DIARY_MISSION_RESULT_WRITER_MOVED_TO_INDEPENDENT_CORE",
    "Mission Result phải được ghi qua Core Mission độc lập.");
  },
  uploadEvidence:(diaryId:string,input:{centerId:string;mimeType:"image/jpeg"|"image/png"|"image/webp";base64:string},
   idempotencyKey:string)=>post<unknown>(
   "/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/evidence",input,idempotencyKey),
  close:(diaryId:string,input:{centerId:string;expectedVersion:number;interest:number;notes:string;difficulty?:string|null},
   idempotencyKey:string)=>{
   positiveVersion(input.expectedVersion);validatedInterest(input.interest);
   return post<V18bPathDiary>("/learning/path-diaries/"+requireValue(diaryId,"DIARY")+"/close",input,idempotencyKey);
  },
 };
}
export const tosClassroomV18bApi=createV18bApiTransport(V18B_WRITE_ADMITTED);
