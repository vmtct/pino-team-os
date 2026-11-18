/** PAP-1955 · BO Payroll Exception S2 read-only Core interface (no decision writer). */
import type {ReviewedException,ReviewPage,ReviewStatus} from "./bo-payroll-extra-review-api";
export type {ReviewedException,ReviewPage,ReviewStatus};
/** PAP-1959: native read-only enrichment, never change legacy decision command DTO. */
export type NativeReviewedException=Omit<ReviewedException,"decision">&{
 staffLegalFullName?:string|null;createdAt?:string|null;createdBy?:string|null;submittedBy?:string|null;
 updatedAt?:null;updatedBy?:null;
 reviewEligibility?:{centerId:string;requestId:string;canReview:boolean};
 decision:(NonNullable<ReviewedException["decision"]>&{reviewerLegalFullName?:string|null})|null;
};
export type NativeReviewPage=Omit<ReviewPage,"data">&{data:NativeReviewedException[]};
export class ExceptionReadError extends Error {
 constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
const ROOT="/api/bo/workforce/payroll/read-only/extra-time/reviews";
async function coreGet<T>(path:string,fetcher:typeof fetch=fetch):Promise<T>{
 const response=await fetcher(path,{method:"GET",cache:"no-store",credentials:"same-origin"});
 const value=await response.json() as T&{error?:{code?:string;message?:string}};
 if(!response.ok)throw new ExceptionReadError(response.status,value.error?.code??"UNKNOWN",
  value.error?.message??"Không thể đọc danh sách ngoại lệ từ Core.");
 return value;
}
export const exceptionReadApi={
 list:(input:{centerId:string;startDate:string;endDate:string;status?:ReviewStatus;
  offset?:number;limit?:number},fetcher?:typeof fetch)=>{
  const q=new URLSearchParams({centerId:input.centerId,startDate:input.startDate,endDate:input.endDate,
   offset:String(input.offset??0),limit:String(input.limit??50)});
  if(input.status)q.set("status",input.status);
  return coreGet<{data:NativeReviewPage}>(ROOT+"?"+q,fetcher);
 },
 detail:(centerId:string,requestId:string,fetcher?:typeof fetch)=>
  coreGet<{data:NativeReviewedException}>(ROOT+"/"+encodeURIComponent(requestId)+"?centerId="+encodeURIComponent(centerId),fetcher),
} as const;

/** PAP-1955: server advisory is fail closed, never inferred from a role or selected Center. */
export function canReviewStandalone(row:NativeReviewedException,centerId:string,requestId:string):boolean{
 const e=row.reviewEligibility;
 return row.centerId===centerId&&row.id===requestId&&row.status==="PENDING"&&row.decision===null&&
  !!e&&e.centerId===centerId&&e.requestId===requestId&&e.canReview===true;
}
export function sameStandaloneRequest(a:NativeReviewedException,b:NativeReviewedException){
 return a.id===b.id&&a.centerId===b.centerId&&a.staffMemberId===b.staffMemberId&&a.assignmentId===b.assignmentId&&a.workDate===b.workDate&&a.requestedStartAt===b.requestedStartAt&&a.requestedEndAt===b.requestedEndAt&&a.requestReason===b.requestReason;
}
