/** PAP-1955 · Pure presentation from authorized Core extra-time review response. */
import type {NativeReviewedException,ReviewStatus} from "./bo-payroll-exceptions-read";
import {payrollVerifiedName,payrollAuditTime} from "./bo-payroll-safe-read-metadata";
export interface ExceptionReadRow {
 id:string;centerId:string;staffMemberId:string;staffLegalName:string;
 submittedBy:string;workDate:string;assignmentId:string;
 requestedWindow:string;requestedStartAt:string;requestedEndAt:string;
 requestReason:string;status:ReviewStatus;statusLabel:string;
 reviewedWindow:string;reviewedMinutes:number|null;reviewedAmountMinor:number|null;
 reviewerName:string;reviewerId:string|null;reviewedAt:string;
 decisionReason:string;createdAt:string;createdBy:string;updatedAt:string;updatedBy:string;
 source:NativeReviewedException;
}
export const NA="—";
export const labels:Record<ReviewStatus,string>={
 PENDING:"Chờ duyệt",WITHDRAWN:"Đã rút",APPROVED:"Đã duyệt",REJECTED:"Từ chối",
};
export function vietnamTime(value:string|null|undefined):string {
 if(!value)return NA;
 const at=Date.parse(value);
 if(!Number.isFinite(at))return NA;
 return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",
 hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(at));
}
export function vietnamDateTime(value:string|null|undefined):string {
 if(!value)return NA;
 const at=Date.parse(value);
 if(!Number.isFinite(at))return NA;
 return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",
 day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(at));
}
export function minorVnd(value:number|null):string {
 if(value===null||!Number.isSafeInteger(value))return NA;
 return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(value)+" ₫";
}
export function validExceptionRange(start:string,end:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return false;
 const a=Date.parse(start+"T00:00:00Z"),b=Date.parse(end+"T00:00:00Z");
 return Number.isFinite(a)&&Number.isFinite(b)&&
  new Date(a).toISOString().slice(0,10)===start&&
  new Date(b).toISOString().slice(0,10)===end&&b>=a&&(b-a)/86400000<=90;
}
export function toExceptionReadRow(row:NativeReviewedException,selectedCenterId:string):ExceptionReadRow {
 if(!selectedCenterId||row.centerId!==selectedCenterId)throw Error("PAYROLL_EXCEPTION_CROSS_CENTER");
 if(!row.id||!row.staffMemberId||!row.workDate)throw Error("PAYROLL_EXCEPTION_SOURCE_ID_MISSING");
 const d=row.decision;
 return {
  id:row.id,centerId:row.centerId,staffMemberId:row.staffMemberId,
  // PAP-1959: exact verified server fields only; never infer creator from subject staff.
  staffLegalName:payrollVerifiedName(row.staffLegalFullName),submittedBy:payrollVerifiedName(row.submittedBy),workDate:row.workDate,assignmentId:row.assignmentId,
  requestedStartAt:row.requestedStartAt,requestedEndAt:row.requestedEndAt,
  requestedWindow:vietnamTime(row.requestedStartAt)+" – "+vietnamTime(row.requestedEndAt),
  requestReason:row.requestReason,status:row.status,statusLabel:labels[row.status],
  reviewedWindow:d?.type==="APPROVED"?
   vietnamTime(d.startAt)+" – "+vietnamTime(d.endAt):NA,
  reviewedMinutes:d?.type==="APPROVED"?d.minutes:null,
  reviewedAmountMinor:d?.type==="APPROVED"?d.amountMinor:null,
  // reviewerId is a technical identifier; never masquerade as verified legal name.
  reviewerName:payrollVerifiedName(d?.reviewerLegalFullName),reviewerId:d?.reviewerId??null,
  reviewedAt:vietnamDateTime(d?.reviewedAt),
  decisionReason:d?.reason??NA,
  // Genuine request creation metadata only; decision review time is not request updatedAt.
  createdAt:payrollAuditTime(row.createdAt),createdBy:payrollVerifiedName(row.createdBy),updatedAt:NA,updatedBy:NA,source:row,
 };
}
