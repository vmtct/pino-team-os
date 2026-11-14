import {type BoPayPeriodRead,type PeriodStaffPage,type PayPeriodDates} from "./bo-payroll-period-api";
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
  centerName,staffCount:rollup.nextOffset===null?staffWithWorkEvidence(rollup.rows).length:null,
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
