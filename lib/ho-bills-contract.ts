/** PAP-1422 / PAP-1362 / PLT-BILL-HO. Projection of the private Founder billing transport. */
export const HO_BILLS_API = "/api/ho/billing/bills";
export const billIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const object = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
export function isHoBillsRequest(path: string, method: string): boolean {
  const suffix = path.startsWith(HO_BILLS_API) ? path.slice(HO_BILLS_API.length) : null;
  if (suffix === "") return method === "GET";
  if (!suffix) return false;
  const parts = suffix.split("/");
  return parts[0] === "" && billIdPattern.test(parts[1] ?? "") &&
    (parts.length === 2 && method === "GET" || parts.length === 3 && parts[2] === "void" && method === "POST");
}
export type BillItem = { id: string; billId: string; studentProfileId: string; subscriptionId: string; productPlanId: string;
  quantity: number; unitPriceMinor: number; discountAmountMinor: number; descriptionSnapshot: string; createdAt: string };
export type BillTransaction = { id: string; billId: string; transactionKind: "PAYMENT" | "REFUND"; amountMinor: number;
  occurredAt: string; method: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER"; reference: string | null; note: string | null;
  status: "CONFIRMED" | "VOID"; createdAt: string; updatedAt: string; version: number };
export type BillAudit = { occurredAt: string; actorType: string; actorId: string | null; action: string;
  outcome: "succeeded" | "failed" | "denied"; reason: string | null };
// PAP-1422 / PAP-1539 / PLT-BILL-HO: Core independently grants/validates PII.
export type HoBillSubjectDisplay = {state:"REDACTED";label:null}|{state:"VERIFIED";label:string};
export type HoBillSubjects = {payerDisplay:HoBillSubjectDisplay;
  students:Array<{studentProfileId:string;display:HoBillSubjectDisplay}>};
export type HoBill = {
  bill: { id: string; payerParentUserId: string; currency: string; billDiscountMinor: number; dueOn: string | null;
    campaignReference: string | null; voidedAt: string | null; createdAt: string; updatedAt: string; version: number };
  items: BillItem[]; transactions: BillTransaction[]; specialtyItems: []; walkinItems: [];
  grossAmountMinor: number; itemDiscountMinor: number; netAmountMinor: number; collectedAmountMinor: number; balanceMinor: number;
  paymentState: "OPEN" | "PARTIALLY_PAID" | "PAID" | "VOID"; isOverdue: boolean;
  history?: BillAudit[];
  /** Center is verified only from immutable Core Draft Issue provenance, never guessed. */
  originCenter?: {state:"VERIFIED";centerId:string;centerName:string}|{state:"UNAVAILABLE";centerId:null;centerName:null};
  billSubjects?: HoBillSubjects;
};
const money = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const text = (v: unknown): v is string => typeof v === "string";
const nullableText = (v: unknown): v is string | null => v === null || text(v);
const timestamp = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
const id = (v: unknown): v is string => text(v) && billIdPattern.test(v);
const version = (v: unknown): v is number => money(v) && v > 0;
const invalid = (): never => { throw new Error("Invalid HO Bill contract"); };
function parseSubjectDisplay(value:unknown):HoBillSubjectDisplay {
 const d=object(value);
 if(d?.state==="REDACTED"&&d.label===null)return {state:"REDACTED",label:null};
 if(d?.state!=="VERIFIED"||typeof d.label!=="string"||!d.label||d.label.length>160||
    d.label!==d.label.trim())return invalid();
 for(let i=0;i<d.label.length;i++){
  const cp=d.label.charCodeAt(i);
  if(cp<32||cp===127)return invalid();
 }
 return {state:"VERIFIED",label:d.label};
}
/** Explicit projection; never pass arbitrary financial/audit payloads into the browser. */
export function parseHoBill(value: unknown, detail = false): HoBill {
  const x = object(value), b = object(x?.bill);
  if (!x || !b || !id(b.id) || !id(b.payerParentUserId) || !text(b.currency) || !/^[A-Z]{3}$/.test(b.currency) ||
    !money(b.billDiscountMinor) || !nullableText(b.dueOn) || !nullableText(b.campaignReference) ||
    !(b.voidedAt === null || timestamp(b.voidedAt)) || !timestamp(b.createdAt) || !timestamp(b.updatedAt) || !version(b.version) ||
    !Array.isArray(x.items) || !x.items.length || !Array.isArray(x.transactions) ||
    !Array.isArray(x.specialtyItems) || x.specialtyItems.length || !Array.isArray(x.walkinItems) || x.walkinItems.length ||
    !["grossAmountMinor", "itemDiscountMinor", "netAmountMinor", "collectedAmountMinor", "balanceMinor"].every(k => money(x[k])) ||
    !["OPEN", "PARTIALLY_PAID", "PAID", "VOID"].includes(String(x.paymentState)) || typeof x.isOverdue !== "boolean") return invalid();
  const items = x.items.map(raw => {
    const r = object(raw);
    if (!r || !["id", "billId", "studentProfileId", "subscriptionId", "productPlanId"].every(k => id(r[k])) || r.billId !== b.id ||
      r.quantity !== 1 || !money(r.unitPriceMinor) || !money(r.discountAmountMinor) || !text(r.descriptionSnapshot) || !timestamp(r.createdAt)) return invalid();
    return { id:r.id, billId:r.billId, studentProfileId:r.studentProfileId, subscriptionId:r.subscriptionId, productPlanId:r.productPlanId,
      quantity:r.quantity, unitPriceMinor:r.unitPriceMinor, discountAmountMinor:r.discountAmountMinor, descriptionSnapshot:r.descriptionSnapshot, createdAt:r.createdAt } as BillItem;
  });
  const transactions = x.transactions.map(raw => {
    const r = object(raw);
    if (!r || !id(r.id) || r.billId !== b.id || !["PAYMENT", "REFUND"].includes(String(r.transactionKind)) ||
      !version(r.amountMinor) || !["CASH", "BANK_TRANSFER", "CARD", "OTHER"].includes(String(r.method)) || !["CONFIRMED", "VOID"].includes(String(r.status)) ||
      !timestamp(r.occurredAt) || !timestamp(r.createdAt) || !timestamp(r.updatedAt) || !version(r.version) || !nullableText(r.reference) || !nullableText(r.note)) return invalid();
    return { id:r.id, billId:r.billId, transactionKind:r.transactionKind, amountMinor:r.amountMinor, occurredAt:r.occurredAt, method:r.method,
      reference:r.reference, note:r.note, status:r.status, createdAt:r.createdAt, updatedAt:r.updatedAt, version:r.version } as BillTransaction;
  });
  if (new Set(items.map(r => r.id)).size !== items.length || new Set(transactions.map(r => r.id)).size !== transactions.length) return invalid();
  // Additive Core provenance, fail closed for absent/legacy read projections.
  // An invalid verified Center is never displayed as an authoritative name.
  const rawCenter=x.originCenter;
  let originCenter:NonNullable<HoBill["originCenter"]>={state:"UNAVAILABLE",centerId:null,centerName:null};
  if(rawCenter!==undefined&&rawCenter!==null){
    const oc=object(rawCenter);
    if(!oc)return invalid();
    if(oc.state==="VERIFIED"){
      if(!id(oc.centerId)||!text(oc.centerName)||!oc.centerName.trim()||oc.centerName.length>180)return invalid();
      originCenter={state:"VERIFIED",centerId:oc.centerId,centerName:oc.centerName};
    }else if(oc.state!=="UNAVAILABLE"||oc.centerId!==null||oc.centerName!==null)return invalid();
  }
  // Never promote arbitrary source labels. Core separately checks Founder GLOBAL
  // custom identity grant and actual Bill/Guardian/Center, not billing.view.
  const studentIds=[...new Set(items.map(item=>item.studentProfileId))];
  const denied:HoBillSubjectDisplay={state:"REDACTED",label:null};
  let billSubjects:HoBillSubjects={payerDisplay:denied,students:studentIds.map(
    studentProfileId=>({studentProfileId,display:denied}))};
  if(x.billSubjects!==undefined&&x.billSubjects!==null){
    const subjects=object(x.billSubjects);
    if(!subjects||!Array.isArray(subjects.students)||subjects.students.length!==studentIds.length)return invalid();
    const students=subjects.students.map(raw=>{
      const value=object(raw);
      if(!value||!id(value.studentProfileId)||!studentIds.includes(value.studentProfileId))return invalid();
      return {studentProfileId:value.studentProfileId,display:parseSubjectDisplay(value.display)};
    });
    if(new Set(students.map(student=>student.studentProfileId)).size!==studentIds.length)return invalid();
    billSubjects={payerDisplay:parseSubjectDisplay(subjects.payerDisplay),students};
  }
  const result: HoBill = { bill: {id:b.id, payerParentUserId:b.payerParentUserId, currency:b.currency, billDiscountMinor:b.billDiscountMinor,
    dueOn:b.dueOn, campaignReference:b.campaignReference, voidedAt:b.voidedAt, createdAt:b.createdAt, updatedAt:b.updatedAt, version:b.version} as HoBill["bill"],
    items, transactions, specialtyItems:[], walkinItems:[], grossAmountMinor:Number(x.grossAmountMinor), itemDiscountMinor:Number(x.itemDiscountMinor), netAmountMinor:Number(x.netAmountMinor),
    collectedAmountMinor:Number(x.collectedAmountMinor), balanceMinor:Number(x.balanceMinor), paymentState:x.paymentState as HoBill["paymentState"], isOverdue:x.isOverdue,originCenter,billSubjects };
  if (detail) {
    if (!Array.isArray(x.history) || x.history.length > 100) return invalid();
    result.history = x.history.map(raw => {
      const r = object(raw);
      if (!r || !timestamp(r.occurredAt) || !text(r.actorType) || !nullableText(r.actorId) || !text(r.action) ||
        !["succeeded", "failed", "denied"].includes(String(r.outcome))) return invalid();
      // Core currently supplies payloadJson; the BFF projection supplies reason only.
      let reason: string | null = nullableText(r.reason) ? r.reason : null;
      if (text(r.payloadJson)) { try { const p = object(JSON.parse(r.payloadJson)); reason = text(p?.reason) ? p.reason : null; } catch { return invalid(); } }
      return {occurredAt:r.occurredAt, actorType:r.actorType, actorId:r.actorId, action:r.action, outcome:r.outcome, reason} as BillAudit;
    });
  }
  return result;
}
export function canVoidBill(b: HoBill): boolean {
  return b.bill.voidedAt === null && b.paymentState === "OPEN" && b.collectedAmountMinor === 0 &&
    !b.transactions.some(t => t.status === "CONFIRMED");
}
export function parseBillVoid(value: unknown): {expectedVersion:number;reason:string;confirmed:true} | null {
  const v = object(value);
  return v && Object.keys(v).every(k => ["expectedVersion", "reason", "confirmed"].includes(k)) && version(v.expectedVersion) &&
    v.confirmed === true && text(v.reason) && v.reason.trim().length > 0 && v.reason.trim().length <= 500
    ? {expectedVersion:v.expectedVersion, reason:v.reason.trim(), confirmed:true} : null;
}
