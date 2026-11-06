// PAP-1526 / PAP-1362 / PLT-BILL-HO: bill-table-read-projection.
import {BoApiError} from "./bo-api-error";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const id=(v:unknown):v is string=>typeof v==="string"&&uuid.test(v);
const count=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const time=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const invalid=():never=>{throw new BoApiError(502,"Dữ liệu bảng Bill không hợp lệ hoặc không đúng cơ sở.",null);};
const redacted=(v:unknown)=>obj(v).state==="REDACTED"&&obj(v).label===null;
export const billTableRoot="/api/bo/billing/bill-table";
export function billTableCenter(path:string):string|null {
 const prefix=billTableRoot+"/center/",value=path.startsWith(prefix)?path.slice(prefix.length):"";
 return id(value)?value:null;
}
export function billTableCursor(v:unknown):v is string {
 if(typeof v!=="string")return false;
 const [status,at,key,...extra]=v.split("~");
 return !extra.length&&["DRAFT","ISSUED"].includes(status)&&time(at)&&id(key);
}
/** Center query carries the existing session adapter constraint, never an ACL grant. */
export function billTableQuery(params:URLSearchParams,center:string):{limit:number;after:string|null}|null {
 if(!id(center)||params.getAll("centerId").length!==1||params.get("centerId")!==center||
  [...params.keys()].some(k=>!["centerId","limit","after"].includes(k)||params.getAll(k).length!==1))return null;
 const raw=params.get("limit"),limit=raw===null?50:Number(raw),after=params.get("after");
 if(raw!==null&&!/^[1-9][0-9]{0,2}$/.test(raw)||!Number.isSafeInteger(limit)||limit<1||limit>100||after!==null&&!billTableCursor(after))return null;
 return {limit,after};
}
export type BillTableItem={draftId:string;billId:string|null;centerId:string;billCode:null;billCodeState:"UNAVAILABLE";
 payerParentUserId:string;payerDisplay:{state:"REDACTED";label:null};distinctStudentCount:number;
 students:{studentProfileId:string;display:{state:"REDACTED";label:null}}[];studentsTruncated:boolean;subscriptionLineCount:number;
 currency:"VND";financialSource:"DRAFT_SNAPSHOT"|"ISSUED_LEDGER";financialState:"AVAILABLE"|"UNAVAILABLE";
 netAmountMinor:number|null;collectedAmountMinor:number|null;balanceMinor:number|null;
 status:"DRAFT"|"OPEN"|"PAID"|"PARTIALLY_PAID"|"VOID";latestConfirmedPaymentAt:string|null;createdAt:string;creationSource:"BILL_DRAFT";
 freshness:{draftVersion:number;billVersion:number|null;transactionCount:number;transactionVersionSum:number;updatedAt:string}};
export type BillTablePage={items:BillTableItem[];hasMore:boolean;nextCursor:string|null;scopeCenterId:string;
 coverage:"CENTER_BOUND_DRAFT_ORIGIN_ONLY";snapshot:"SINGLE_SQL_STATEMENT"};
export function parseBillTablePage(value:unknown,center:string,limit=100):BillTablePage {
 const p=obj(value);
 if(!id(center)||p.scopeCenterId!==center||p.coverage!=="CENTER_BOUND_DRAFT_ORIGIN_ONLY"||p.snapshot!=="SINGLE_SQL_STATEMENT"||
  !Array.isArray(p.items)||p.items.length>limit||typeof p.hasMore!=="boolean"||
  (p.hasMore?(!billTableCursor(p.nextCursor)||p.items.length!==limit):p.nextCursor!==null))return invalid();
 const items=p.items.map(raw=>{
  const r=obj(raw),f=obj(r.freshness),draft=r.status==="DRAFT",available=r.financialState==="AVAILABLE";
  if(!id(r.draftId)||r.centerId!==center||!id(r.payerParentUserId)||r.billCode!==null||r.billCodeState!=="UNAVAILABLE"||!redacted(r.payerDisplay)||
   typeof r.status!=="string"||!["DRAFT","OPEN","PAID","PARTIALLY_PAID","VOID"].includes(r.status)||
   (draft?r.billId!==null:!id(r.billId))||r.currency!=="VND"||r.creationSource!=="BILL_DRAFT"||!time(r.createdAt)||
   r.financialSource!==(draft?"DRAFT_SNAPSHOT":"ISSUED_LEDGER")||typeof r.financialState!=="string"||!["AVAILABLE","UNAVAILABLE"].includes(r.financialState)||
   !count(r.distinctStudentCount)||!count(r.subscriptionLineCount)||r.distinctStudentCount>r.subscriptionLineCount||
   !Array.isArray(r.students)||r.students.length!==Math.min(100,r.distinctStudentCount)||r.studentsTruncated!==(r.distinctStudentCount>100)||
   !count(f.draftVersion)||f.draftVersion<1||!time(f.updatedAt)||f.updatedAt<r.createdAt||
   !count(f.transactionCount)||!count(f.transactionVersionSum)||f.transactionVersionSum<f.transactionCount||
   (f.transactionCount===0&&f.transactionVersionSum!==0)||
   (draft?(f.billVersion!==null||f.transactionCount!==0):(!count(f.billVersion)||f.billVersion<1||r.subscriptionLineCount<1))||
   !(r.latestConfirmedPaymentAt===null||time(r.latestConfirmedPaymentAt))||
   (draft&&r.latestConfirmedPaymentAt!==null)||(r.latestConfirmedPaymentAt!==null&&f.transactionCount===0))return invalid();
  if(available){
   if(!count(r.netAmountMinor)||!count(r.collectedAmountMinor)||!count(r.balanceMinor)||r.collectedAmountMinor>r.netAmountMinor||r.balanceMinor!==r.netAmountMinor-r.collectedAmountMinor||
    (draft&&r.collectedAmountMinor!==0)||(["OPEN","VOID"].includes(String(r.status))&&r.collectedAmountMinor!==0)||
    (r.status==="PAID"&&(r.netAmountMinor===0||r.balanceMinor!==0))||
    (r.status==="PARTIALLY_PAID"&&(r.collectedAmountMinor===0||r.balanceMinor===0))||
    (r.collectedAmountMinor>0&&r.latestConfirmedPaymentAt===null))return invalid();
  }else if(!draft||r.netAmountMinor!==null||r.collectedAmountMinor!==null||r.balanceMinor!==null)return invalid();
  const students=r.students.map(rawStudent=>{const s=obj(rawStudent);if(!id(s.studentProfileId)||!redacted(s.display))return invalid();return {studentProfileId:s.studentProfileId,display:{state:"REDACTED" as const,label:null}};});
  if(new Set(students.map(s=>s.studentProfileId)).size!==students.length)return invalid();
  // Explicit allowlist: upstream extras/identity enrichment never reach the browser.
  return {draftId:r.draftId,billId:r.billId,centerId:center,billCode:null,billCodeState:"UNAVAILABLE",payerParentUserId:r.payerParentUserId,
   payerDisplay:{state:"REDACTED",label:null},distinctStudentCount:r.distinctStudentCount,students,studentsTruncated:r.studentsTruncated,
   subscriptionLineCount:r.subscriptionLineCount,currency:r.currency,financialSource:r.financialSource,financialState:r.financialState,
   netAmountMinor:r.netAmountMinor,collectedAmountMinor:r.collectedAmountMinor,balanceMinor:r.balanceMinor,status:r.status,
   latestConfirmedPaymentAt:r.latestConfirmedPaymentAt,createdAt:r.createdAt,creationSource:r.creationSource,
   freshness:{draftVersion:f.draftVersion,billVersion:f.billVersion,transactionCount:f.transactionCount,transactionVersionSum:f.transactionVersionSum,updatedAt:f.updatedAt}} as BillTableItem;
 });
 if(new Set(items.map(r=>r.draftId)).size!==items.length||new Set(items.filter(r=>r.billId).map(r=>r.billId)).size!==items.filter(r=>r.billId).length)return invalid();
 return {items,hasMore:p.hasMore,nextCursor:p.nextCursor as string|null,scopeCenterId:center,coverage:"CENTER_BOUND_DRAFT_ORIGIN_ONLY",snapshot:"SINGLE_SQL_STATEMENT"};
}
