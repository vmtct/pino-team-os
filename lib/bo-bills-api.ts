// PAP-1421 / PAP-1362 / PLT-BILL-HO. Core owns every financial decision.
import { BoApiError } from "./bo-api-error";
export const billUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type BillDraftLine = {id:string;subscriptionId:string;studentProfileId:string;productPlanId:string;quantity:1;unitPriceMinor:number;discountAmountMinor:number;descriptionSnapshot:string};
export type BillDraft = {id:string;centerId:string;payerParentUserId:string;status:"DRAFT"|"ISSUED";currency:"VND";billDiscountMinor:number;dueOn:string|null;note:string;issuedBillId:string|null;createdAt:string;updatedAt:string;version:number;items:BillDraftLine[]};
export type DraftTerms = {billDiscountMinor:number;dueOn:string|null;note:string};
export type DraftLineInput = Pick<BillDraftLine,"unitPriceMinor"|"discountAmountMinor"|"descriptionSnapshot">;
export type IssuePreview = {draftId:string;centerId:string;expectedVersion:number;subtotalMinor:number;billDiscountMinor:number;netAmountMinor:number;lineCount:number;preflightPass:boolean;blockers:string[]};
const money=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
export function assertBillDraft(value:unknown,centerId:string,id?:string):asserts value is BillDraft {
 const v=value as BillDraft;
 if(!v||!billUuid.test(v.id)||v.centerId!==centerId||(id&&v.id!==id)||!billUuid.test(v.payerParentUserId)||
   !["DRAFT","ISSUED"].includes(v.status)||v.currency!=="VND"||!money(v.billDiscountMinor)||!Number.isSafeInteger(v.version)||v.version<1||
   typeof v.note!=="string"||typeof v.createdAt!=="string"||typeof v.updatedAt!=="string"||
   !(v.dueOn===null||typeof v.dueOn==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v.dueOn))||
   !(v.status==="DRAFT"?v.issuedBillId===null:typeof v.issuedBillId==="string"&&billUuid.test(v.issuedBillId))||
   !Array.isArray(v.items)||v.items.some(i=>!i||![i.id,i.subscriptionId,i.studentProfileId,i.productPlanId].every(s=>billUuid.test(s))||i.quantity!==1||!money(i.unitPriceMinor)||!money(i.discountAmountMinor)||i.discountAmountMinor>i.unitPriceMinor||typeof i.descriptionSnapshot!=="string")||
   new Set(v.items.map(i=>i.subscriptionId)).size!==v.items.length)throw new BoApiError(502,"Dữ liệu Bill không đúng cơ sở hoặc không hợp lệ.",null);
}
export function draftTotal(v:BillDraft):number{return v.items.reduce((n,i)=>n+i.unitPriceMinor-i.discountAmountMinor,0)-v.billDiscountMinor;}
export function billError(e:unknown):string {
 if(e instanceof BoApiError&&e.status===403)return "Bạn không có quyền thao tác Bill tại cơ sở này.";
 if(e instanceof BoApiError&&e.status===409)return "Bill hoặc Subscription đã thay đổi. Tải lại dữ liệu trước khi tiếp tục.";
 return e instanceof Error?e.message:"Không thể kết nối. Hãy thử lại.";
}
export function createBillsApi(fetcher:typeof fetch=fetch){
 async function request<T>(centerId:string,path:string,method="GET",body?:unknown,key?:string,signal?:AbortSignal):Promise<T>{
  if(!billUuid.test(centerId))throw new BoApiError(400,"Chọn cơ sở hợp lệ.",null);
  const response=await fetcher(`/api/bo/billing/bill-drafts${path}?centerId=${encodeURIComponent(centerId)}`,{method,cache:"no-store",credentials:"same-origin",signal,
   ...(body===undefined?{}:{headers:{"content-type":"application/json",...(key?{"idempotency-key":key}:{})},body:JSON.stringify(body)})});
  let data:{data?:T;error?:{message?:string}};
  try{data=await response.json();}catch{throw new BoApiError(response.status,"Phản hồi Bill không hợp lệ.",response.headers.get("x-request-id"),false);}
  if(!response.ok||data.data===undefined)throw new BoApiError(response.status,data.error?.message??"Không thể tải hoặc lưu Bill.",response.headers.get("x-request-id"));
  return data.data;
 }
 function identity(id:string):string{if(!billUuid.test(id))throw new BoApiError(400,"Mã Bill không hợp lệ.",null);return "/"+encodeURIComponent(id);}
 async function draft(center:string,path:string,method="GET",body?:unknown,key?:string,signal?:AbortSignal,id?:string){const value=await request<unknown>(center,path,method,body,key,signal);assertBillDraft(value,center,id);return value;}
 return {
  async list(center:string,signal?:AbortSignal){const rows=await request<unknown>(center,"/center/"+center,"GET",undefined,undefined,signal);if(!Array.isArray(rows)||rows.length>100)throw new BoApiError(502,"Danh sách Bill không hợp lệ.",null);rows.forEach(r=>assertBillDraft(r,center));if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error("Bill trùng lặp");return rows as BillDraft[];},
  get:(center:string,id:string,signal?:AbortSignal)=>draft(center,identity(id),"GET",undefined,undefined,signal,id),
  create:(center:string,payerParentUserId:string,terms:DraftTerms,key:string)=>draft(center,"","POST",{centerId:center,payerParentUserId,...terms},key),
  update:(center:string,id:string,terms:DraftTerms,expectedVersion:number)=>draft(center,identity(id),"PATCH",{...terms,expectedVersion},undefined,undefined,id),
  addLine:(center:string,id:string,subscriptionId:string,line:DraftLineInput,expectedVersion:number,key:string)=>draft(center,identity(id)+"/items","POST",{subscriptionId,...line,expectedVersion},key,undefined,id),
  editLine:(center:string,id:string,lineId:string,line:DraftLineInput,expectedVersion:number)=>draft(center,identity(id)+"/items"+identity(lineId),"PATCH",{...line,expectedVersion},undefined,undefined,id),
  removeLine:(center:string,id:string,lineId:string,expectedVersion:number)=>draft(center,identity(id)+"/items"+identity(lineId),"DELETE",{expectedVersion},undefined,undefined,id),
  async preview(center:string,id:string){const v=await request<IssuePreview>(center,identity(id)+"/issue-preview");if(v.centerId!==center||v.draftId!==id||!Number.isSafeInteger(v.expectedVersion)||!money(v.netAmountMinor)||typeof v.preflightPass!=="boolean"||!Array.isArray(v.blockers))throw new BoApiError(502,"Không xác minh được điều kiện phát hành.",null);return v;},
  issue:(center:string,id:string,expectedVersion:number,key:string)=>request<unknown>(center,identity(id)+"/issue","POST",{expectedVersion},key),
 };
}
export const billsApi=createBillsApi();
