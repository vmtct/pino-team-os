import {type BoPayPeriodRead,type PeriodStaffPage,type PayPeriodDates,type PeriodHistoryPage} from "./bo-payroll-period-api";
import {periodDisplayName,periodSummaries,staffWithWorkEvidence} from "./bo-payroll-read-model";
import {payrollAuditTime,payrollVerifiedName} from "./bo-payroll-safe-read-metadata";

/** PAP-1985 / PAP-1063: scoped, server-authored read projection; no client wage arithmetic. */
export function validNativePeriodDates(input:PayPeriodDates):boolean {
 const valid=(day:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const ms=Date.parse(day+"T00:00:00Z");
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day;
 };
 return valid(input.startDate)&&valid(input.endDate)&&input.startDate<=input.endDate;
}
export function nativePeriodRow(period:BoPayPeriodRead,rollup:PeriodStaffPage,centerId:string,centerName:string){
 if(period.centerId!==centerId||rollup.period.id!==period.id||
  rollup.period.startDate!==period.startDate||rollup.period.endDate!==period.endDate||
  rollup.period.status!==period.status||rollup.totalsScope!=="FULL_PERIOD")throw Error("PAYROLL_PERIOD_SCOPE_MISMATCH");
 if(!validNativePeriodDates(period)||!Number.isSafeInteger(period.version)||period.version<1)
  throw Error("PAYROLL_PERIOD_INVALID");
 const totals=periodSummaries(rollup.periodTotals);
 return {...period,name:periodDisplayName(period.startDate,centerName),
    centerName,staffCount:rollup.staffWithWorkEvidenceCount===undefined?
   (rollup.nextOffset===null&&rollup.offset===0?staffWithWorkEvidence(rollup.rows).length:null):validatedCount(rollup),
  expected:totals.expected,finalized:totals.finalized,
  createdTime:payrollAuditTime(period.createdAt),createdActor:payrollVerifiedName(period.createdBy),
  modifiedTime:payrollAuditTime(period.updatedAt),modifiedActor:payrollVerifiedName(period.updatedBy)};
}
export type NativePeriodRow=ReturnType<typeof nativePeriodRow>;
export function nativePeriodStatus(row:Pick<BoPayPeriodRead,"status"|"dateLocked"|"canceledAt">):string {
 return row.status==="ARCHIVED"?(typeof row.canceledAt==="string"&&row.canceledAt.length>0?"Đã hủy":"Lưu trữ"):row.dateLocked?"Đã khóa ngày":"Đang mở";
}
export function mayCancelNativePeriod(row:Pick<BoPayPeriodRead,"canCancel"|"status"|"dateLocked"|"canceledAt">):boolean {
 return row.canCancel===true&&row.status==="ACTIVE"&&!row.dateLocked&&!row.canceledAt;
}

function validatedCount(rollup:PeriodStaffPage):number{
 const n=rollup.staffWithWorkEvidenceCount;
 if(typeof n!=="number"||!Number.isSafeInteger(n)||n<0||n>rollup.totalStaffCount||n<staffWithWorkEvidence(rollup.rows).length)
  throw Error("PAYROLL_PERIOD_COUNT_MISMATCH");
 return n;
}
const historyLabels:Record<string,string>={
 PAYROLL_PERIOD_CREATED:"Tạo kỳ lương",
 PAYROLL_PERIOD_UPDATED:"Cập nhật kỳ lương",
 PAYROLL_PERIOD_CANCELLED:"Hủy kỳ lương",
};
export function nativePeriodHistory(page:PeriodHistoryPage,centerId:string,periodId:string,offset:number){
 if(page.centerId!==centerId||page.periodId!==periodId||page.offset!==offset||!Array.isArray(page.events)||page.events.length>50||
  (page.nextOffset!==null&&(!Number.isSafeInteger(page.nextOffset)||page.nextOffset!==offset+page.events.length||page.events.length===0))||
  new Set(page.events.map(e=>e.id)).size!==page.events.length)throw Error("PAYROLL_HISTORY_SCOPE_MISMATCH");
 return page.events.map(e=>{
  if(!e.id||!Object.hasOwn(historyLabels,e.action))throw Error("PAYROLL_HISTORY_EVENT_INVALID");
  return {id:e.id,action:historyLabels[e.action]!,time:payrollAuditTime(e.occurredAt),actor:payrollVerifiedName(e.actorName)};
 });
}
