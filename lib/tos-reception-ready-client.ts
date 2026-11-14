/** PAP-763: Core receipts alone establish READY; no localStorage or optimistic OPEN. */
export type ReceptionReadyScope={centerId:string;workDate:string;shiftTemplateId:string};
export type ReceptionReadySlot=ReceptionReadyScope & {label:string};
export type ReceptionReadyReceipt={receipt_id:string;center_id:string;work_date:string;shift_template_id:string;opened_at:string};
export type ReceptionReadyState={state:"NOT_READY";receipt:null;canConfirm:boolean}|{state:"READY";receipt:ReceptionReadyReceipt;canConfirm:false;canAppend?:boolean;history?:ReceptionEvidenceEvent[]};
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
  return parseReadySnapshot(await call(scope,{method:"GET",...(signal?{signal}:{})}),scope);
}
function parseReadySnapshot(raw:unknown,scope:ReceptionReadyScope):ReceptionReadyState{
  const value=raw as {state?:string;receipt?:unknown;canConfirm?:boolean;canAppend?:boolean;history?:unknown;centerId?:string;workDate?:string;shiftTemplateId?:string}|null;
  if(value?.state==="READY"){
    const r=receipt(value.receipt,scope);
    if(value.history===undefined)return {state:"READY",receipt:r,canConfirm:false};
    if(value.centerId!==scope.centerId||value.workDate!==scope.workDate||value.shiftTemplateId!==scope.shiftTemplateId||typeof value.canAppend!=="boolean")throw new Error("Biên nhận mở ca không đúng phạm vi.");
    return {state:"READY",receipt:r,canConfirm:false,canAppend:value.canAppend,history:parseReceptionHistory(value.history)};
  }
  if(value?.state==="NOT_READY"&&value.receipt===null)return {state:"NOT_READY",receipt:null,canConfirm:value.canConfirm===true};
  throw new Error("Chưa nhận được trạng thái ca hợp lệ.");
}
export async function confirmReceptionReady(scope:ReceptionReadyScope,photoData:string):Promise<ReceptionReadyReceipt>{
  const value=await call(scope,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({centerId:scope.centerId,workDate:scope.workDate,shiftTemplateId:scope.shiftTemplateId,photo:parseReceptionPhoto(photoData)})}) as {outcome?:string;receipt?:unknown}|null;
  if(value?.outcome!=="CREATED"&&value?.outcome!=="REPLAYED")throw new Error("Chưa nhận được biên nhận mở ca.");
  return receipt(value.receipt,scope);
}

export type ReceptionEvidenceEvent={eventId:string;roundId:string;version:number;kind:"SUBMISSION"|"REVIEW";actorLegalFullName:string|null;occurredAt:string;privateAssetIds:readonly string[];note:string;verdict:"APPROVED"|"REJECTED"|null;reason:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function parseReceptionHistory(value:unknown):ReceptionEvidenceEvent[]{
 if(!Array.isArray(value)||!value.length)throw new Error("Lịch sử mở ca không hợp lệ.");
 const seen=new Set<string>(),assets=new Set<string>();let previous:ReceptionEvidenceEvent|undefined;
 return value.map((raw:unknown,i)=>{
  const e=raw as ReceptionEvidenceEvent|null;
  if(!e||!uuid.test(e.eventId)||seen.has(e.eventId)||!uuid.test(e.roundId)||e.version!==i+1||
     !Number.isFinite(Date.parse(e.occurredAt))||(previous&&e.occurredAt<previous.occurredAt)||
     (e.actorLegalFullName!==null&&(typeof e.actorLegalFullName!=="string"||!e.actorLegalFullName.trim()||e.actorLegalFullName.length>160))||
     !Array.isArray(e.privateAssetIds)||typeof e.note!=="string"||e.note.length>1000)throw new Error("Lịch sử mở ca không hợp lệ.");
  if(e.kind==="SUBMISSION"){
    if(e.roundId!==e.eventId||e.privateAssetIds.length<1||e.privateAssetIds.length>10||e.verdict!==null||e.reason!==null)throw new Error("Lịch sử mở ca không hợp lệ.");
    for(const asset of e.privateAssetIds){if(!uuid.test(asset)||assets.has(asset))throw new Error("Lịch sử mở ca không hợp lệ.");assets.add(asset);}
  }else if(e.kind!=="REVIEW"||previous?.kind!=="SUBMISSION"||e.roundId!==previous.roundId||
    e.privateAssetIds.length!==0||e.note!==""||!["APPROVED","REJECTED"].includes(e.verdict??"")||
    typeof e.reason!=="string")throw new Error("Lịch sử mở ca không hợp lệ.");
  seen.add(e.eventId);previous=e;return e;
 });
}
export function newReceptionCorrectionKey():string{
 const b=crypto.getRandomValues(new Uint8Array(16));let ms=Date.now();
 for(let i=5;i>=0;i--){b[i]=ms%256;ms=Math.floor(ms/256);}
 b[6]=(b[6]!&15)|112;b[8]=(b[8]!&63)|128;
 const h=Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");
 return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
export async function appendReceptionEvidence(scope:ReceptionReadyScope,state:Extract<ReceptionReadyState,{state:"READY"}>,images:readonly string[],note:string,key:string){
 if(!state.canAppend||!state.history?.length||!uuid.test(key)||images.length<1||images.length>10||note.trim().length>1000)throw new Error("Không đủ điều kiện bổ sung ảnh.");
 const photos=images.map(parseReceptionPhoto);
 if(photos.reduce((n,p)=>n+Math.floor(p.base64.length*3/4),0)>10*1024*1024)throw new Error("Tổng dung lượng ảnh vượt 10 MB.");
 const res=await fetch("/api/workforce/reception/ready/append",{method:"POST",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({...scope,openingReceiptId:state.receipt.receipt_id,expectedVersion:state.history.length,requestKey:key,photos,note:note.trim()})});
 if(!res.ok)throw new Error(res.status===409?"Thông tin đã thay đổi. Tải lại trước khi gửi.":"Không thể xác nhận ảnh bổ sung.");
 const result=parseReadySnapshot((await res.json() as {data?:unknown}).data,scope);
 if(result.state!=="READY"||result.receipt.receipt_id!==state.receipt.receipt_id||(result.history?.length??0)<=state.history.length)throw new Error("Chưa xác minh được vòng ảnh bổ sung.");
 return result;
}
export async function receptionEvidencePhoto(scope:ReceptionReadyScope,receiptId:string,assetId:string,signal?:AbortSignal){
 if(!uuid.test(receiptId)||!uuid.test(assetId))throw new Error("Ảnh không hợp lệ.");
 const res=await fetch("/api/workforce/reception/ready/photo?"+new URLSearchParams({...scope,openingReceiptId:receiptId,assetId}),{cache:"no-store",...(signal?{signal}:{})});
 if(!res.ok)throw new Error("Không thể xác minh ảnh private.");
 const {data}=await res.json() as {data?:Photo};
 if(!data)throw new Error("Ảnh không hợp lệ.");
 const uri="data:"+data.mimeType+";base64,"+data.base64;parseReceptionPhoto(uri);return uri;
}
