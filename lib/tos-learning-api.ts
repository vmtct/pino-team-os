export type AttendanceStatus="PRESENT"|"ABSENT";
export interface DaySession{id:string;pathProgramId:string;pathDisplayName:string;runningClassId:string|null;operationalName:string|null;learningSpaceId:string|null;learningSpaceDisplayName:string|null;localDate:string;scheduledStartsLocal:string;scheduledEndsLocal:string;status:string;primarySyllabusId:string|null}
export interface RosterSource{basis:string;sourceId:string;sourceType:"ENROLLMENT"|"BOOKING"|"RENEWAL_GRACE"}
export interface RosterEntry{status:"CANDIDATE"|"CONFLICT";studentProfileId:string;studentDisplayName:string;sources:RosterSource[]}
export interface ResolvedParticipation{studentProfileId:string;studentDisplayName:string;participationId:string;basis:string;commercialConsequence:string;attendanceId:string;attendanceStatus:AttendanceStatus;attendanceVersion:number;diaryId:string|null;diaryVersion:number|null;diaryRecordState:"ACTIVE"|"VOIDED"|null}
export interface SessionRoster{entries:RosterEntry[];unresolvedRegistrations:Array<{registrationId:string;sessionId:string}>;resolvedParticipations:ResolvedParticipation[]}
export interface LearningOptions{sessionId:string;pathProgramId:string;primarySyllabusId:string|null;syllabi:Array<{id:string;title:string;publicationStatus:string}>}
export class TosLearningApiError extends Error{constructor(readonly status:number,readonly code:string,message:string,readonly details?:unknown){super(message);}}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(`/api/tos-learning/${path}`,{cache:"no-store",...init,headers:{...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
 const body=await response.json() as T&{error?:{code?:string;message?:string;details?:unknown}};
 if(!response.ok)throw new TosLearningApiError(response.status,body.error?.code??"UNKNOWN",body.error?.message??"Không thể hoàn tất thao tác lớp học.",body.error?.details);
 return body;
}
const qs=(value:Record<string,string>)=>new URLSearchParams(value).toString();
export const tosLearningApi={
 sessionsDay:(centerId:string,localDate:string)=>request<{data:{centerId:string;localDate:string;sessions:DaySession[]}}>(`sessions/day?${qs({centerId,localDate})}`),
 roster:(sessionId:string)=>request<{data:SessionRoster}>(`sessions/${encodeURIComponent(sessionId)}/roster`),
 learningOptions:(sessionId:string)=>request<{data:LearningOptions}>(`sessions/${encodeURIComponent(sessionId)}/learning-options`),
 settleRecurring:(input:{studentProfileId:string;sessionId:string;enrollmentId:string;attendanceStatus:AttendanceStatus;recordedAt:string;diary?:{syllabusId:string;learningOwnerStaffId:string;learningNote?:string|null;observation?:string|null}})=>request<{data:{participation:{id:string;commercialConsequence:string};attendance:{id:string;status:AttendanceStatus;version:number};diary?:{id:string;version:number}}}>("participation/settle",{method:"POST",headers:{"idempotency-key":`classroom-recurring-v1:${input.sessionId}:${input.studentProfileId}:${input.attendanceStatus}:${input.recordedAt}`},body:JSON.stringify({studentProfileId:input.studentProfileId,sessionId:input.sessionId,basis:"RECURRING",enrollmentId:input.enrollmentId,attendanceStatus:input.attendanceStatus,recordedAt:input.recordedAt,...(input.diary?{diary:input.diary}:{})})}),
};
