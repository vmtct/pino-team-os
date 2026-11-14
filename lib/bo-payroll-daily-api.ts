/** PAP-1954 · Private BO Daily Payroll, read-only. Core is sole financial truth. */
export type DayStatus="READY"|"NO_ATTENDANCE"|"NO_ASSIGNMENT"|
 "PENDING_CHECKOUT"|"RATE_MISSING"|"RECONCILIATION_REQUIRED";
export interface DailyWorkRecord {
 base:{
  calculationVersion:string;staffMemberId:string;centerId:string;workDate:string;
  status:DayStatus;paidMinutes:number|null;amountMinor:number|null;
  hourlyRateMinor:number|null;rateEntryId:string|null;rateVersion:number|null;
  assignmentIds:string[];sessionIds:string[];correctionIds:string[];
  coverageSourceIds:string[];
  payableIntervals:{startsAt:string;endsAt:string}[];
 };
 source:{
  attendance:{sessionId:string;status:string;recordedCheckInAt:string;
   recordedCheckOutAt:string|null;effectiveCheckInAt:string;effectiveCheckOutAt:string|null;
   correctionId:string|null}[];
  coverage:{assignmentId:string;coverageMode:string;startLocal:string|null;endLocal:string|null}[];
 };
 effective:{status:DayStatus;paidMinutes:number|null;amountMinor:number|null};
 override:null|{id:string;version:number;paidMinutes:number;amountMinor:number;
  reason:string;baseFingerprint:string;createdByUserId:string;createdAt:string};
 overrideStale:boolean;overrideVersion:number;sourceFingerprint:string;
}
export interface DailyPage {data:DailyWorkRecord[];total:number;nextOffset:number|null}
export class DailyReadError extends Error {
 constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
const ROOT="/api/bo/workforce/payroll/daily";
async function get<T>(url:string,fetcher:typeof fetch=fetch):Promise<T>{
 const response=await fetcher(url,{credentials:"same-origin",cache:"no-store"});
 const value=await response.json() as T&{error?:{code?:string;message?:string}};
 if(!response.ok)throw new DailyReadError(response.status,value.error?.code??"UNKNOWN",
  value.error?.message??"Không thể đọc bảng lương ngày.");
 return value;
}
export const dailyReadApi={
 list:(input:{centerId:string;startDate:string;endDate:string;staffMemberId?:string;
  limit?:number;offset?:number},fetcher?:typeof fetch)=>{
  const qs=new URLSearchParams({centerId:input.centerId,startDate:input.startDate,endDate:input.endDate});
  if(input.staffMemberId)qs.set("staffMemberId",input.staffMemberId);
  if(input.limit!==undefined)qs.set("limit",String(input.limit));
  if(input.offset!==undefined)qs.set("offset",String(input.offset));
  return get<{data:DailyPage}>(ROOT+"?"+qs,fetcher);
 },
 detail:(centerId:string,staffMemberId:string,workDate:string,fetcher?:typeof fetch)=>
  get<{data:DailyWorkRecord}>(ROOT+"/"+encodeURIComponent(staffMemberId)+"/"+
   encodeURIComponent(workDate)+"?centerId="+encodeURIComponent(centerId),fetcher),
};
