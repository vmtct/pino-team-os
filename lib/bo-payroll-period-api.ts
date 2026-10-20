/** BO-only PAP-808 client: no private payroll data in localStorage or generic staff directory. */
export interface PayPeriod{
 id:string;centerId:string;name:string;startDate:string;endDate:string;
 status:"ACTIVE"|"ARCHIVED";version:number;dateLocked:boolean;createdAt:string;updatedAt:string|null;
}
export interface PeriodStaff{
 staffMemberId:string;status:"DRAFT"|"PENDING"|"FINALIZED"|"PAID"|"ARCHIVED_UNAVAILABLE";
 amountMinor:number|null;provisionalAmountMinor:number|null;warnings:string[];
 preview:SettlementPreview|null;settlementId:string|null;
}
export interface SettlementPreview{
 centerId:string;periodId:string;periodVersion:number;periodStartDate:string;periodEndDate:string;
 staffMemberId:string;amountMinor:number;adjustmentsMinor:number;extraTimeMinor:number;
 days:{workDate:string;status:string;paidMinutes:number|null;amountMinor:number|null}[];
 adjustments:{id:string;amountMinor:number;reason:string}[];
 extraTimeDecisions:{id:string;decision:"APPROVED"|"REJECTED";amountMinor:number|null}[];
 warnings:string[];sourceFingerprint:string;
}
export interface PeriodStaffPage{
 period:Pick<PayPeriod,"id"|"name"|"startDate"|"endDate"|"status">;
 rows:PeriodStaff[];totalStaffCount:number;limit:number;offset:number;nextOffset:number|null;
 totalsScope:"FULL_PERIOD";periodTotals:{
  knownMinor:number;draftMinor:number;finalizedMinor:number;paidMinor:number;
  pendingProvisionalMinor:number;draftCount:number;pendingCount:number;
  finalizedCount:number;paidCount:number;archivedUnavailableCount:number;
  hasPending:boolean;hasUnavailable:boolean;
 };asOf:string;
}
export class PayrollPeriodApiError extends Error{
 constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
const ROOT="/api/bo/workforce/payroll/periods";
async function call<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(path,{...init,cache:"no-store",credentials:"same-origin",
  headers:{...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
 const data=await response.json() as T&{error?:{code?:string;message?:string}};
 if(!response.ok)throw new PayrollPeriodApiError(response.status,data.error?.code??"UNKNOWN",
  data.error?.message??"Không thể tải kỳ lương từ Core.");
 return data;
}
const qs=(centerId:string,extra:Record<string,string>={})=>"?"+new URLSearchParams({centerId,...extra});
export const periodApi={
 list:(centerId:string,offset=0)=>call<{data:{data:PayPeriod[];total:number;nextOffset:number|null}}>(
  ROOT+qs(centerId,{limit:"50",offset:String(offset)})),
 get:(centerId:string,id:string)=>call<{data:PayPeriod}>(ROOT+"/"+id+qs(centerId)),
 create:(centerId:string,input:{name:string;startDate:string;endDate:string},key:string)=>
  call<{data:PayPeriod}>(ROOT+qs(centerId),{method:"POST",headers:{"idempotency-key":key},
   body:JSON.stringify({centerId,...input})}),
 edit:(centerId:string,period:PayPeriod,input:{name:string;startDate:string;endDate:string})=>
  call<{data:PayPeriod}>(ROOT+"/"+period.id+qs(centerId),{method:"PATCH",
   body:JSON.stringify({centerId,...input,expectedVersion:period.version})}),
 staff:(centerId:string,id:string,offset=0)=>call<{data:PeriodStaffPage}>(
  ROOT+"/"+id+"/staff-rollup"+qs(centerId,{limit:"25",offset:String(offset)})),
 preview:(centerId:string,id:string,staffId:string)=>call<{data:SettlementPreview}>(
  ROOT+"/"+id+"/staff/"+staffId+"/preview"+qs(centerId)),
 finalize:(centerId:string,id:string,staffId:string,preview:SettlementPreview,key:string)=>
  call<{data:{id:string;status:"FINALIZED"}}>(ROOT+"/"+id+"/staff/"+staffId+"/finalize"+qs(centerId),{
   method:"POST",headers:{"idempotency-key":key},
   body:JSON.stringify({centerId,expectedFingerprint:preview.sourceFingerprint,
    acknowledgedWarnings:preview.warnings})}),
 paid:(centerId:string,settlementId:string,paymentDate:string,paymentReference:string,key:string)=>
  call<{data:{id:string;status:"PAID"}}>(
   "/api/bo/workforce/payroll/settlements/"+settlementId+"/paid"+qs(centerId),{
    method:"POST",headers:{"idempotency-key":key},
    body:JSON.stringify({centerId,paymentDate,paymentReference})}),
};
export const money=(value:number|null)=>value===null?"—":
 new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(value)+" ₫";
export function validPeriodInput(input:{name:string;startDate:string;endDate:string}){
 return !!input.name.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)&&
  /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)&&input.startDate<=input.endDate;
}
