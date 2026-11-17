/** PAP-1954 · Display-only BO Payroll Daily ledger. Core alone computes financial truth. */
import type {DailyWorkRecord} from "./bo-payroll-daily-api";
import {payrollVerifiedName} from "./bo-payroll-safe-read-metadata";

export interface BoPayrollDailyRow {
 id:string;staffMemberId:string;staffDisplayName:string;centerId:string;workDate:string;
 status:DailyWorkRecord["effective"]["status"];assignmentRefs:string;recordedInOut:string;
 actualInOut:string;paidMinutes:number|null;appliedRateMinor:number|null;standardMinor:number|null;
 effectiveMinor:number|null;overrideStatus:string;createdAt:string;createdBy:string;
 updatedAt:string;updatedBy:string;source:DailyWorkRecord["source"];override:DailyWorkRecord["override"];
}
const missing="—";
function time(value:string|null|undefined):string {
 if(!value)return missing;
 const timestamp=Date.parse(value);
 if(!Number.isFinite(timestamp))return missing;
 return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(timestamp));
}
export function displayDailyMoney(value:number|null):string {
 if(value===null||!Number.isSafeInteger(value))return missing;
 return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(value)+" ₫";
}
export function payrollDailyRow(record:DailyWorkRecord,expectedCenterId:string):BoPayrollDailyRow {
 if(!expectedCenterId||record.base.centerId!==expectedCenterId)
  throw new Error("PAYROLL_DAILY_CROSS_CENTER_RESPONSE");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.base.workDate)||!record.base.staffMemberId)
  throw new Error("PAYROLL_DAILY_SOURCE_ID_MISSING");
 const actual=record.source.attendance.map(item=>
  time(item.effectiveCheckInAt)+"–"+time(item.effectiveCheckOutAt)).join("; ")||missing;
 const recorded=record.source.attendance.map(item=>
  time(item.recordedCheckInAt)+"–"+time(item.recordedCheckOutAt)).join("; ")||missing;
 return {
  id:expectedCenterId+"/"+record.base.staffMemberId+"/"+record.base.workDate,
  centerId:expectedCenterId,staffMemberId:record.base.staffMemberId,
  // PAP-1959: trust only the verified, scoped Core field; old Core stays missing.
  staffDisplayName:payrollVerifiedName(record.staffLegalFullName),workDate:record.base.workDate,status:record.effective.status,
  assignmentRefs:record.source.coverage.map(item=>item.assignmentId).join(", ")||missing,
  recordedInOut:recorded,actualInOut:actual,
  paidMinutes:record.effective.paidMinutes,appliedRateMinor:record.base.hourlyRateMinor,
  standardMinor:record.base.amountMinor,effectiveMinor:record.effective.amountMinor,
  overrideStatus:record.overrideStale?"Cần đối soát":record.override?"Đã điều chỉnh":"Không",
  // Derived day is not a persisted entity. Override metadata is a separate event.
  createdAt:missing,createdBy:missing,updatedAt:missing,updatedBy:missing,
  source:record.source,override:record.override,
 };
}
export function validDailyWindow(start:string,end:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return false;
 const a=Date.parse(start+"T00:00:00Z"),b=Date.parse(end+"T00:00:00Z");
 return Number.isFinite(a)&&Number.isFinite(b)&&
  new Date(a).toISOString().slice(0,10)===start&&
  new Date(b).toISOString().slice(0,10)===end&&b>=a&&(b-a)/86400000<=30;
}
