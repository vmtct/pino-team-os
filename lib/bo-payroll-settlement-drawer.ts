import type {SettlementPreview} from "./bo-payroll-period-api";
import type {ReviewedException,decisionPayload} from "./bo-payroll-extra-review-api";
import type {IncomePeriod} from "./bo-payroll-income-read";
import {scopedIncomeRow,scopedIncomeDay,verifiedFinancialCapabilities} from "./bo-payroll-income-read";
import {exceptionReadApi,type NativeReviewedException} from "./bo-payroll-exceptions-read";
import {validExceptionRange} from "./bo-payroll-exceptions-model";

/** PAP-1956: read only, exact selected period and PTE. Frozen totals are never recomputed. */
export function settlementDrawerSource(row:IncomePeriod,centerId:string,periodId:string,staffId:string){
 const source=scopedIncomeRow({period:row.period,totalsScope:"FULL_PERIOD",rows:[row.staff]},centerId,periodId,staffId);
 if(!source||!source.staff.preview)throw Error("PAYROLL_DRAWER_SOURCE_UNAVAILABLE");
 const p=source.staff.preview;
 if(!Array.isArray(p.days)||!Array.isArray(p.adjustments)||!Array.isArray(p.extraTimeDecisions)||
    !Array.isArray(p.warnings)||p.warnings.some(w=>typeof w!=="string")||p.adjustments.some(a=>!a||typeof a.id!=="string"||!a.id||!Number.isSafeInteger(a.amountMinor)||typeof a.reason!=="string")||new Set(p.adjustments.map(a=>a.id)).size!==p.adjustments.length||p.days.some(day=>scopedIncomeDay(source,day.workDate)!==day))
  throw Error("PAYROLL_DRAWER_SOURCE_MISMATCH");
 return {...source,preview:p,frozen:source.staff.status==="FINALIZED"||source.staff.status==="PAID"};
}
type Reader=Pick<typeof exceptionReadApi,"list"|"detail">;
export async function settlementDrawerExceptions(row:IncomePeriod,centerId:string,periodId:string,staffId:string,api:Reader=exceptionReadApi){
 const {period,preview,frozen}=settlementDrawerSource(row,centerId,periodId,staffId);
 const matches=(r:NativeReviewedException)=>r.centerId===centerId&&r.staffMemberId===staffId&&r.workDate>=period.startDate&&r.workDate<=period.endDate;
 if(frozen){
  const rows=await Promise.all(preview.extraTimeDecisions.map(async d=>{
   if(!d.requestId)throw Error("PAYROLL_DRAWER_SNAPSHOT_REQUEST_UNAVAILABLE");
   const r=(await api.detail(centerId,d.requestId)).data;
   if(!matches(r)||r.id!==d.requestId||!r.decision||r.decision.id!==d.id||
     r.status!==d.decision||r.decision.type!==d.decision||r.decision.amountMinor!==d.amountMinor||(d.workDate!==undefined&&r.workDate!==d.workDate))throw Error("PAYROLL_DRAWER_SNAPSHOT_EXCEPTION_MISMATCH");
   return r;
  }));
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error("PAYROLL_DRAWER_DUPLICATE_EXCEPTION");
  return rows;
 }
 const rows:NativeReviewedException[]=[]; const seen=new Set<string>();
 const start=Date.parse(period.startDate+"T00:00:00Z"),end=Date.parse(period.endDate+"T00:00:00Z");
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>365*86400000)throw Error("PAYROLL_DRAWER_PERIOD_RANGE");
 const date=(ms:number)=>new Date(ms).toISOString().slice(0,10);
 for(let cursor=start;cursor<=end;cursor+=91*86400000){
  const startDate=date(cursor),endDate=date(Math.min(end,cursor+90*86400000));
  if(!validExceptionRange(startDate,endDate))throw Error("PAYROLL_DRAWER_PERIOD_RANGE");
  let offset=0;
  for(let page=0;;page++){
   if(page>=100)throw Error("PAYROLL_DRAWER_EXCEPTION_LIMIT");
   const r=(await api.list({centerId,startDate,endDate,offset,limit:100})).data;
   if(!Array.isArray(r.data)||r.data.length>100||!Number.isSafeInteger(r.total)||r.total<offset+r.data.length)
    throw Error("PAYROLL_DRAWER_EXCEPTION_PAGE");
   for(const item of r.data){
    if(item.centerId!==centerId||item.workDate<startDate||item.workDate>endDate||!item.id||seen.has(item.id))
     throw Error("PAYROLL_DRAWER_EXCEPTION_SCOPE");
    seen.add(item.id);if(matches(item))rows.push(item);
   }
   if(r.nextOffset===null){if(offset+r.data.length!==r.total)throw Error("PAYROLL_DRAWER_EXCEPTION_PAGE");break;}
   if(r.nextOffset!==offset+r.data.length||r.nextOffset<=offset||r.nextOffset>=r.total)throw Error("PAYROLL_DRAWER_EXCEPTION_PAGE");
   offset=r.nextOffset;
  }
 }
 return rows;
}
export function pendingSettlementException(warnings:string[],rows:NativeReviewedException[]){
 return warnings.some(w=>w.startsWith("EXTRA_TIME_PENDING:"))||rows.some(r=>r.status==="PENDING");
}

/** Read-only readiness; never authorizes nor submits a financial command. */
export function settlementReadiness(source:ReturnType<typeof settlementDrawerSource>,capability:unknown,centerId:string,rows:NativeReviewedException[],exceptionError:string){
 const rights=verifiedFinancialCapabilities(capability,centerId);
 if(source.preview.centerId!==centerId||!rights.canManageSettlement)return "NO_CAPABILITY";
 if(source.period.status!=="ACTIVE"||source.frozen||!["DRAFT","PENDING"].includes(source.staff.status))return "LOCKED";
 if(exceptionError)return "EXCEPTIONS_UNVERIFIED";
 if(rows.some(r=>r.centerId!==centerId||r.staffMemberId!==source.staff.staffMemberId||r.workDate<source.period.startDate||r.workDate>source.period.endDate))return "EXCEPTIONS_UNVERIFIED";
 if(pendingSettlementException(source.preview.warnings,rows))return "PENDING_EXCEPTION";
 if(!/^[a-f0-9]{64}$/.test(source.preview.sourceFingerprint))return "SOURCE_UNVERIFIED";
 return "PREVIEW_REQUIRED";
}

/** Read-only preview must match the selected snapshot before confirmation. */
export function verifiedSettlementPreview(source:ReturnType<typeof settlementDrawerSource>,next:SettlementPreview){
 if(source.frozen||source.period.status!=="ACTIVE"||next.centerId!==source.preview.centerId||next.periodId!==source.period.id||
  next.staffMemberId!==source.staff.staffMemberId||next.periodStartDate!==source.period.startDate||next.periodEndDate!==source.period.endDate||
  next.periodVersion!==source.preview.periodVersion||!/^[a-f0-9]{64}$/.test(next.sourceFingerprint)||
  next.sourceFingerprint!==source.preview.sourceFingerprint||!Number.isSafeInteger(next.amountMinor)||next.amountMinor!==source.preview.amountMinor||
  !Array.isArray(next.warnings)||next.warnings.some(w=>typeof w!=="string")||
  pendingSettlementException(next.warnings,[])||JSON.stringify(next.warnings)!==JSON.stringify(source.preview.warnings))
 throw Error("Dữ liệu quyết toán đã thay đổi hoặc chưa đủ điều kiện. Vui lòng tải lại.");
 return next;
}
/** Advisory action eligibility, never a substitute for Core's authenticated ACL. */
export function canReviewSettlementException(source:ReturnType<typeof settlementDrawerSource>,capability:unknown,centerId:string,requestId:string,row:NativeReviewedException){
 return verifiedFinancialCapabilities(capability,centerId).canReviewExtraTime&&source.preview.centerId===centerId&&
  source.period.status==="ACTIVE"&&!source.frozen&&["DRAFT","PENDING"].includes(source.staff.status)&&
  row.id===requestId&&row.centerId===centerId&&row.staffMemberId===source.staff.staffMemberId&&
  row.workDate>=source.period.startDate&&row.workDate<=source.period.endDate&&row.status==="PENDING"&&row.decision===null;
}

/** Validate an existing command receipt against the fresh request and independent readback. */
export function verifiedReviewReceipt(before:NativeReviewedException,receipt:ReviewedException,readback:NativeReviewedException,payload:ReturnType<typeof decisionPayload>){
 const fail=()=>{throw Error("PAYROLL_REVIEW_READBACK_UNVERIFIED");};
 if(before.status!=="PENDING"||before.decision!==null||before.centerId!==payload.centerId||before.id!==payload.requestId)fail();
 const sameRequest=(r:ReviewedException)=>r.id===before.id&&r.centerId===before.centerId&&r.staffMemberId===before.staffMemberId&&r.assignmentId===before.assignmentId&&r.workDate===before.workDate&&r.requestedStartAt===before.requestedStartAt&&r.requestedEndAt===before.requestedEndAt&&r.requestReason===before.requestReason;
 const a=receipt.decision,b=readback.decision;
 if(!sameRequest(receipt)||!sameRequest(readback)||receipt.status!==payload.decision||readback.status!==payload.decision||
    !a||!b||!a.id||a.id!==b.id||a.type!==payload.decision||b.type!==payload.decision||a.reason!==payload.reason||b.reason!==payload.reason)throw Error("PAYROLL_REVIEW_READBACK_UNVERIFIED");
 if(a.amountMinor!==b.amountMinor||a.minutes!==b.minutes||a.hourlyRateMinor!==b.hourlyRateMinor||a.rateEntryId!==b.rateEntryId||a.rateVersion!==b.rateVersion||a.sourceFingerprint!==b.sourceFingerprint||!a.reviewerId||a.reviewerId!==b.reviewerId||a.reviewedAt!==b.reviewedAt)fail();
 if(payload.decision==="APPROVED"){
  const start=Date.parse(payload.approvedStartAt??""),end=Date.parse(payload.approvedEndAt??"");
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||[a,b].some(x=>Date.parse(x.startAt??"")!==start||Date.parse(x.endAt??"")!==end))fail();
 }else if([a,b].some(x=>x.startAt!==null||x.endAt!==null))fail();
 return readback;
}

/** Product input validation only. No transport or permission decision. VND is an integer unit. */
export function validatedAdjustmentInput(amount:string,reason:string){
 const signed=amount.trim(),text=reason.trim();
 if(!/^[+-]?[0-9]{1,13}$/.test(signed))throw Error("Số tiền điều chỉnh phải là số nguyên có dấu.");
 const amountMinor=Number(signed);
 if(!Number.isSafeInteger(amountMinor)||amountMinor===0||Math.abs(amountMinor)>1_000_000_000_000)
  throw Error("Số tiền điều chỉnh không hợp lệ.");
 if(text.length<3||text.length>500)throw Error("Lý do phải từ 3 đến 500 ký tự.");
 return {amountMinor,reason:text};
}

/** Local draft estimate only; Core must authorize and compute the actual adjustment. */
export function canPreviewAdjustment(source:ReturnType<typeof settlementDrawerSource>,capability:unknown,centerId:string){
 return verifiedFinancialCapabilities(capability,centerId).canManageSettlement&&source.preview.centerId===centerId&&
  source.period.status==="ACTIVE"&&!source.frozen&&["DRAFT","PENDING"].includes(source.staff.status)&&
  /^[a-f0-9]{64}$/.test(source.preview.sourceFingerprint);
}
export function projectAdjustmentDraft(source:ReturnType<typeof settlementDrawerSource>,capability:unknown,centerId:string,amount:string,reason:string){
 if(!canPreviewAdjustment(source,capability,centerId))
  throw Error("Không đủ điều kiện điều chỉnh thu nhập.");
 const entry=validatedAdjustmentInput(amount,reason);
 const current=source.preview.amountMinor,projected=current+entry.amountMinor;
 if(!Number.isSafeInteger(current)||current<0||current>1_000_000_000_000||
  !Number.isSafeInteger(projected)||projected<0||projected>1_000_000_000_000)
  throw Error("Tổng thu nhập sau điều chỉnh phải không âm và trong giới hạn Core.");
 return {...entry,currentAmountMinor:current,projectedAmountMinor:projected};
}

export function settlementDrawerHref(centerId:string,periodId:string,staffId:string){
 return "/bo/payroll-periods?"+new URLSearchParams({centerId,record:periodId,tab:"settlements",incomeDrawer:staffId});
}
export function settlementExceptionHref(centerId:string,periodId:string,staffId:string,requestId:string){
 return "/bo/payroll-periods?"+new URLSearchParams({centerId,record:periodId,incomeStaff:staffId,incomeException:requestId});
}
/** Selected request only; compare immutable decision identity on a frozen snapshot. */
export async function settlementExceptionDetail(row:IncomePeriod,centerId:string,periodId:string,staffId:string,requestId:string,api:Pick<Reader,"detail">=exceptionReadApi){
 const {period,preview,frozen}=settlementDrawerSource(row,centerId,periodId,staffId);
 const decision=preview.extraTimeDecisions.filter(d=>d.requestId===requestId);
 if(frozen&&decision.length!==1)throw Error("PAYROLL_DRAWER_EXCEPTION_NOT_IN_SNAPSHOT");
 const r=(await api.detail(centerId,requestId)).data;
 if(r.id!==requestId||r.centerId!==centerId||r.staffMemberId!==staffId||r.workDate<period.startDate||r.workDate>period.endDate)
  throw Error("PAYROLL_DRAWER_EXCEPTION_SCOPE");
 if(frozen){
  const d=decision[0];
  if(!r.decision||r.decision.id!==d.id||r.status!==d.decision||r.decision.type!==d.decision||r.decision.amountMinor!==d.amountMinor||(d.workDate!==undefined&&r.workDate!==d.workDate))
   throw Error("PAYROLL_DRAWER_SNAPSHOT_EXCEPTION_MISMATCH");
 }
 return r;
}

/** PAP-1956: compare the Core command receipt to an independent selected Staff/Period preview.
 * A concurrent unrelated source change is not a verified confirmation of the displayed estimate.
 * This pure verifier is not authorization or transport admission.
 */
export function verifiedAdjustmentReceipt(before:SettlementPreview,receipt:unknown,after:SettlementPreview,input:{amountMinor:number;reason:string}):SettlementPreview{
 const fail=()=>{throw Error("PAYROLL_ADJUSTMENT_READBACK_UNVERIFIED");};
 if(!receipt||typeof receipt!=="object")return fail();
 const r=receipt as Record<string,unknown>;
 const sameScope=after.centerId===before.centerId&&after.periodId===before.periodId&&after.staffMemberId===before.staffMemberId&&after.periodVersion===before.periodVersion&&after.periodStartDate===before.periodStartDate&&after.periodEndDate===before.periodEndDate;
 if(!sameScope||r.centerId!==before.centerId||r.periodId!==before.periodId||r.staffMemberId!==before.staffMemberId||typeof r.id!=="string"||!r.id||r.amountMinor!==input.amountMinor||r.reason!==input.reason||r.category!==null||r.reversesAdjustmentId!==null||typeof r.createdByUserId!=="string"||!r.createdByUserId||typeof r.createdAt!=="string"||!Number.isFinite(Date.parse(r.createdAt)))return fail();
 if(!Number.isSafeInteger(input.amountMinor)||input.amountMinor===0||!Number.isSafeInteger(before.amountMinor)||!Number.isSafeInteger(before.adjustmentsMinor)||!Number.isSafeInteger(after.amountMinor)||!Number.isSafeInteger(after.adjustmentsMinor)||after.amountMinor!==before.amountMinor+input.amountMinor||after.adjustmentsMinor!==before.adjustmentsMinor+input.amountMinor||after.amountMinor<0||!/^[a-f0-9]{64}$/.test(before.sourceFingerprint)||!/^[a-f0-9]{64}$/.test(after.sourceFingerprint)||after.sourceFingerprint===before.sourceFingerprint)return fail();
 if(!Array.isArray(before.adjustments)||!Array.isArray(after.adjustments)||after.adjustments.length!==before.adjustments.length+1||before.adjustments.some(a=>a.id===r.id)||new Set(after.adjustments.map(a=>a.id)).size!==after.adjustments.length)return fail();
 const byId=new Map(after.adjustments.map(a=>[a.id,a]));
 if(before.adjustments.some(a=>{const b=byId.get(a.id);return !b||a.amountMinor!==b.amountMinor||a.reason!==b.reason;}))return fail();
 const entry=byId.get(r.id);
 if(!entry||entry.amountMinor!==input.amountMinor||entry.reason!==input.reason||after.extraTimeMinor!==before.extraTimeMinor||JSON.stringify(after.days)!==JSON.stringify(before.days)||JSON.stringify(after.extraTimeDecisions)!==JSON.stringify(before.extraTimeDecisions)||JSON.stringify(after.warnings)!==JSON.stringify(before.warnings))return fail();
 return after;
}
