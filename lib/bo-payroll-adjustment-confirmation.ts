import type {IncomePage} from "./bo-payroll-income-read";
import {canPreviewAdjustment,projectAdjustmentDraft,settlementDrawerSource,verifiedAdjustmentReceipt} from "./bo-payroll-settlement-drawer";
type Source=ReturnType<typeof settlementDrawerSource>;
type Draft=ReturnType<typeof projectAdjustmentDraft>;
export type AdjustmentCommand={centerId:string;periodId:string;staffId:string;amountMinor:number;reason:string;expectedFingerprint:string;idempotencyKey:string};
export type AdjustmentConfirmationIO={
 read:(centerId:string,periodId:string,staffId:string)=>Promise<IncomePage>;
 submit:(command:AdjustmentCommand)=>Promise<unknown>;
 active:()=>boolean;
 nonce:()=>string;
};
export class AdjustmentConfirmationError extends Error{
 constructor(readonly submitted:boolean){super(submitted?"PAYROLL_ADJUSTMENT_READBACK_UNVERIFIED":"PAYROLL_ADJUSTMENT_PREVIEW_CHANGED")}
}
/** PAP-1956: explicit confirmation, no automatic retry. Transport injected separately. */
export async function confirmAdjustment(source:Source,draft:Draft,io:AdjustmentConfirmationIO){
 const {centerId,periodId,staffMemberId:staffId}=source.preview;
 let submitted=false;
 try{
  if(!io.active())throw Error("inactive");
  const page=await io.read(centerId,periodId,staffId);
  const fresh=settlementDrawerSource(page.current,centerId,periodId,staffId);
  const assertPage=(p:IncomePage)=>p.centerId===centerId&&p.anchorPeriodId===periodId&&p.staffMemberId===staffId;
  if(!assertPage(page)||!canPreviewAdjustment(fresh,page.financialCapabilities,centerId)||
    fresh.preview.sourceFingerprint!==source.preview.sourceFingerprint||
    fresh.preview.periodVersion!==source.preview.periodVersion||fresh.preview.amountMinor!==draft.currentAmountMinor||
    fresh.period.startDate!==source.period.startDate||fresh.period.endDate!==source.period.endDate)throw Error("stale");
  const projected=projectAdjustmentDraft(fresh,page.financialCapabilities,centerId,String(draft.amountMinor),draft.reason);
  if(projected.amountMinor!==draft.amountMinor||projected.reason!==draft.reason||projected.currentAmountMinor!==draft.currentAmountMinor||
    projected.projectedAmountMinor!==draft.projectedAmountMinor)throw Error("draft changed");
  const nonce=io.nonce();
  if(!/^[A-Za-z0-9-]{8,64}$/.test(nonce)||!io.active())throw Error("inactive");
  submitted=true;
  const receipt=await io.submit({centerId,periodId,staffId,amountMinor:draft.amountMinor,reason:draft.reason,
   expectedFingerprint:fresh.preview.sourceFingerprint,idempotencyKey:"pay-adjust-"+fresh.preview.sourceFingerprint+":"+nonce});
  const after=await io.read(centerId,periodId,staffId);
  if(!assertPage(after))throw Error("scope changed");
  const result=settlementDrawerSource(after.current,centerId,periodId,staffId);
  if(result.frozen||result.period.status!=="ACTIVE"||!["DRAFT","PENDING"].includes(result.staff.status))throw Error("locked");
  verifiedAdjustmentReceipt(fresh.preview,receipt,result.preview,draft);
  return after;
 }catch{throw new AdjustmentConfirmationError(submitted)}
}