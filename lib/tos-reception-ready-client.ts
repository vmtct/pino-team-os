/** PAP-763: Core receipts alone establish READY; no localStorage or optimistic OPEN. */
export type ReceptionReadyScope={centerId:string;workDate:string;shiftTemplateId:string};
export type ReceptionReadySlot=ReceptionReadyScope & {label:string};
export type ReceptionReadyReceipt={receipt_id:string;center_id:string;work_date:string;shift_template_id:string;opened_at:string};
export type ReceptionReadyState={state:"NOT_READY";receipt:null;canConfirm:boolean}|{state:"READY";receipt:ReceptionReadyReceipt;canConfirm:false};
type Photo={mimeType:"image/jpeg"|"image/png"|"image/webp";base64:string};
export function parseReceptionPhoto(data:string):Photo{
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if(!match||!match[2]||match[2].length>Math.ceil(2*1024*1024/3)*4)throw new Error("Ảnh setup không hợp lệ hoặc vượt 2 MB.");
  const mimeType=match[1] as Photo["mimeType"];
  return {mimeType,base64:match[2]};
}
function receipt(value:unknown,scope:ReceptionReadyScope):ReceptionReadyReceipt{
  const row=value as Partial<ReceptionReadyReceipt>|null;
  if(!row||typeof row.receipt_id!=="string"||!row.receipt_id||
     row.center_id!==scope.centerId||row.work_date!==scope.workDate||row.shift_template_id!==scope.shiftTemplateId||
     typeof row.opened_at!=="string"||!Number.isFinite(Date.parse(row.opened_at)))throw new Error("Biên nhận mở ca không đúng phạm vi.");
  return {receipt_id:row.receipt_id,center_id:row.center_id,work_date:row.work_date,shift_template_id:row.shift_template_id,opened_at:row.opened_at};
}
async function call(scope:ReceptionReadyScope,init:RequestInit):Promise<unknown>{
  const endpoint="/api/workforce/reception/ready";
  const url=init.method==="POST"?endpoint:endpoint+"?"+new URLSearchParams({centerId:scope.centerId,workDate:scope.workDate,shiftTemplateId:scope.shiftTemplateId});
  const res=await fetch(url,{...init,cache:"no-store"});
  if(!res.ok)throw new Error(res.status===403?"Bạn chưa được phép xác nhận ca này.":"Chưa thể xác minh mở ca. Vui lòng thử lại.");
  const body=await res.json() as {data?:unknown};
  return body.data;
}
export async function readReceptionReady(scope:ReceptionReadyScope,signal?:AbortSignal):Promise<ReceptionReadyState>{
  const value=await call(scope,{method:"GET",...(signal?{signal}:{})}) as {state?:string;receipt?:unknown;canConfirm?:boolean}|null;
  if(value?.state==="READY")return {state:"READY",receipt:receipt(value.receipt,scope),canConfirm:false};
  if(value?.state==="NOT_READY"&&value.receipt===null)return {state:"NOT_READY",receipt:null,canConfirm:value.canConfirm===true};
  throw new Error("Chưa nhận được trạng thái ca hợp lệ.");
}
export async function confirmReceptionReady(scope:ReceptionReadyScope,photoData:string):Promise<ReceptionReadyReceipt>{
  const value=await call(scope,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({centerId:scope.centerId,workDate:scope.workDate,shiftTemplateId:scope.shiftTemplateId,photo:parseReceptionPhoto(photoData)})}) as {outcome?:string;receipt?:unknown}|null;
  if(value?.outcome!=="CREATED"&&value?.outcome!=="REPLAYED")throw new Error("Chưa nhận được biên nhận mở ca.");
  return receipt(value.receipt,scope);
}
