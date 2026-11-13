// PAP-1426 / SCH-STUDENT-MGMT: narrow Center-scoped Student adapter.
// Intentionally separate from the shared bo-api.ts TDD admission fence.
import type { BoLearnerDirectoryItem, BoLearnerLifecycle } from "./bo-model";
import { BoApiError } from "./bo-api-error";

type Envelope<T>={data?:T;error?:{message?:string;requestId?:string}};
function scopeCenter(centerId:string):string {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(centerId)) {
    throw new BoApiError(400,"Cần chọn cơ sở hợp lệ.",null);
  }
  return encodeURIComponent(centerId);
}
async function requestData<T>(path:string,init:RequestInit={cache:"no-store"},fetcher:typeof fetch=fetch):Promise<T> {
  const response=await fetcher(`/api/bo/${path}`,init);
  let payload:Envelope<T>;
  try {payload=await response.json() as Envelope<T>;}
  catch {throw new BoApiError(response.status,"Back Office trả về dữ liệu không hợp lệ.",response.headers.get("x-request-id"),false);}
  if(!response.ok||payload.data===undefined){
    throw new BoApiError(response.status,payload.error?.message??"Không thể tải hoặc cập nhật học viên.",payload.error?.requestId??response.headers.get("x-request-id"));
  }
  return payload.data;
}
export const studentCenterApi={
  // One read-only Center-scoped entitlement check per Student workspace.
  // The Core PATCH still reauthorizes current affiliation and this exact Center at mutation time.
  editCapability:async(centerId:string,fetcher?:typeof fetch):Promise<boolean>=>{
    const data=await requestData<{studentProfileEditAllowed?:boolean}>(
      `context?centerId=${scopeCenter(centerId)}`,{cache:"no-store"},fetcher
    );
    return data.studentProfileEditAllowed===true;
  },
  learners:(query:string,limit:number,beforeStudentId:string|undefined,centerId:string,fetcher?:typeof fetch)=>{
    const p=new URLSearchParams({limit:String(limit),centerId:scopeCenter(centerId)});
    if(query)p.set("query",query);
    if(beforeStudentId)p.set("beforeStudentId",beforeStudentId);
    return requestData<BoLearnerDirectoryItem[]>(`learners?${p.toString()}`,{cache:"no-store"},fetcher);
  },
  learnerLifecycle:(studentId:string,centerId:string,fetcher?:typeof fetch)=>{
    return requestData<BoLearnerLifecycle>(`students/${encodeURIComponent(studentId)}/lifecycle?centerId=${scopeCenter(centerId)}`,{cache:"no-store"},fetcher);
  },
  updateStudentGender:(studentId:string,body:{gender:"MALE"|"FEMALE";expectedVersion:number},centerId:string)=>
    requestData<{id:string;gender:"MALE"|"FEMALE";version:number}>(
      `students/${encodeURIComponent(studentId)}/gender?centerId=${scopeCenter(centerId)}`,
      {method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)},
    ),
  updateStudentProfile:(studentId:string,body:{displayName:string;expectedVersion:number},centerId:string,fetcher?:typeof fetch)=>{
    return requestData<{id:string;displayName:string;status:"ACTIVE"|"INACTIVE"|"ARCHIVED";version:number}>(
      `students/${encodeURIComponent(studentId)}?centerId=${scopeCenter(centerId)}`,
      {method:"PATCH",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)},
      fetcher
    );
  },
};
