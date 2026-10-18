import { BoApiError } from "./bo-api-error";

export interface BoStudentVisit {
  id: string;
  studentProfileId: string;
  student: { id: string; displayName: string };
  centerId: string;
  center: { id: string; displayName: string; timeZone: string };
  checkedInAt: string;
  checkedOutAt: string | null;
  status: "OPEN" | "CLOSED";
  durationSeconds: number | null;
  sourceRegistrationId: string | null;
  recordedByUserId: string | null;
  checkInReason: string | null;
  checkedOutByUserId: string | null;
  checkoutReason: string | null;
  correctedAt: string | null;
  correctedByUserId: string | null;
  correctionReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface BoStudentVisitDetail extends BoStudentVisit {
  timeline: Array<{ id:string; occurredAt:string; action:string; actorUserId:string|null; requestId:string; details:unknown }>;
  timelineTruncated: boolean;
}
export interface BoStudentVisitsPage {
  data: BoStudentVisit[];
  total: number;
  summary: { totalVisits:number; openVisits:number; closedVisits:number };
}
export interface BoVisitCommandResult {
  visit: BoStudentVisit;
  receipt: {requestId:string;action:string;source:"BO"};
}
export interface BoVisitFilter {
  centerId:string; query?:string; studentProfileId?:string; status?:"OPEN"|"CLOSED";
  startAt?:string;endBefore?:string;sort?:"checkIn"|"checkOut"|"student"|"status";
  order?:"asc"|"desc";limit:number;offset:number;
}
export function studentVisitsPath(query:BoVisitFilter):string {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query)) if(value!==undefined&&value!==null&&String(value)!=="") params.set(key,String(value));
  return `student-visits?${params.toString()}`;
}
async function api<T>(path:string,options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/bo/${path}`,{cache:"no-store",...options});
  let body:{data?:T;error?:{code?:string;message?:string;requestId?:string}};
  try{body=await response.json() as typeof body;}catch{throw new BoApiError(response.status,"Invalid BO response",response.headers.get("x-request-id"),false);}
  if(!response.ok||body.data===undefined){
    throw new BoApiError(response.status,body.error?.message??"BO Visit operation failed",response.headers.get("x-request-id")??body.error?.requestId??null,Boolean(body.error?.message));
  }
  return body.data;
}
export const boStudentVisits={
  list:(filter:BoVisitFilter)=>api<BoStudentVisitsPage>(studentVisitsPath(filter)),
  detail:(visitId:string,centerId:string)=>api<BoStudentVisitDetail>(`student-visits/${encodeURIComponent(visitId)}?centerId=${encodeURIComponent(centerId)}`),
  checkOut:(visitId:string,body:{centerId:string;expectedVersion:number;checkedOutAt:string;reason:string},key:string)=>
    api<BoVisitCommandResult>(`student-visits/${encodeURIComponent(visitId)}/check-out`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)}),
  correct:(visitId:string,body:{centerId:string;expectedVersion:number;checkedInAt:string;checkedOutAt:string|null;checkInReason:string|null;checkoutReason:string|null;reason:string},key:string)=>
    api<BoVisitCommandResult>(`student-visits/${encodeURIComponent(visitId)}/correct`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)})
};
