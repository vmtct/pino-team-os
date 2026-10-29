export type AttendanceStatus="PRESENT"|"ABSENT";
export interface DaySession{id:string;pathProgramId:string;pathDisplayName:string;runningClassId:string|null;operationalName:string|null;learningSpaceId:string|null;learningSpaceDisplayName:string|null;localDate:string;scheduledStartsLocal:string;scheduledEndsLocal:string;status:string;primarySyllabusId:string|null}
export interface RosterSource{basis:string;sourceId:string;sourceType:"ENROLLMENT"|"BOOKING"|"RENEWAL_GRACE"}
export interface RosterEntry{status:"CANDIDATE"|"CONFLICT";studentProfileId:string;studentDisplayName:string;sources:RosterSource[]}
export interface ResolvedParticipation{studentProfileId:string;studentDisplayName:string;participationId:string;basis:string;commercialConsequence:string;attendanceId:string;attendanceStatus:AttendanceStatus;attendanceVersion:number;diaryId:string|null;diaryVersion:number|null;diaryRecordState:"ACTIVE"|"VOIDED"|null}
export interface SessionRoster{entries:RosterEntry[];unresolvedRegistrations:Array<{registrationId:string;sessionId:string}>;resolvedParticipations:ResolvedParticipation[]}
export interface LearningSyllabusVersionProjection{id:string;syllabusId:string;versionNumber:number;state:"PUBLISHED";title:string;shortDescription:string|null;publicDescription:string|null;tags:string[];thumbnailMediaId:string|null;coverMediaId:string|null}
export interface LearningOptions{sessionId:string;pathProgramId:string;learningSyllabusVersionId:string|null;learningSyllabusVersion:LearningSyllabusVersionProjection|null;primarySyllabusId:string|null;syllabi:Array<{id:string;title:string;publicationStatus:string}>}
export class TosLearningApiError extends Error{constructor(readonly status:number,readonly code:string,message:string,readonly details?:unknown){super(message);}}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(`/api/tos-learning/${path}`,{cache:"no-store",...init,headers:{...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
 const body=await response.json() as T&{error?:{code?:string;message?:string;details?:unknown}};
 if(!response.ok)throw new TosLearningApiError(response.status,body.error?.code??"UNKNOWN",body.error?.message??"Không thể tải dữ liệu lớp học.",body.error?.details);
 return body;
}
const qs=(value:Record<string,string>)=>new URLSearchParams(value).toString();
export const tosLearningApi={
 walkinPassLookup:(centerId:string,code:string)=>request<{data:{pass:{id:string;code:string;path_code:"AC"|"LPP"|"LPA"|"PH";status:string;parent_user_id:string};parentName:string|null;students:Array<{id:string;name:string}>}}>("open-studio/walkin/lookup?"+qs({centerId,code})),
 consumeWalkinPass:(data:{centerId:string;code:string;shiftId:string;confirmedHolder:true;studentId?:string|null;manualChildName?:string|null})=>request<{data:{id:string;status:"CONSUMED";child_name:string;student_id:string|null}}>("open-studio/walkin/consume",{method:"POST",headers:{"idempotency-key":crypto.randomUUID()},body:JSON.stringify(data)}),
 sessionsDay:(centerId:string,localDate:string)=>request<{data:{centerId:string;localDate:string;sessions:DaySession[]}}>(`sessions/day?${qs({centerId,localDate})}`),
 roster:(sessionId:string)=>request<{data:SessionRoster}>(`sessions/${encodeURIComponent(sessionId)}/roster`),
 learningOptions:(sessionId:string)=>request<{data:LearningOptions}>(`sessions/${encodeURIComponent(sessionId)}/learning-options`),
};
