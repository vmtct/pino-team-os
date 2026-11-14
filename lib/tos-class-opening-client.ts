import type {OpeningRecord,OpeningRound} from "./tos-classroom-v4-view-model";

/** PAP-1991 / PAP-759. Core receipt is the only OPEN truth. */
export type ClassOpeningScope={centerId:string;runningClassId:string;localDate:string};
export type ClassOpeningSnapshot={opening:OpeningRecord|null;canConfirm:boolean};
type History={eventId:string;roundId:string;version:number;kind:"SUBMISSION"|"REVIEW";actorLegalFullName:string|null;
  occurredAt:string;privateAssetId:string|null;verdict:"APPROVED"|"REJECTED"|null;reason:string|null};
const ROOT="/api/workforce/class-opening";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validTime=(value:unknown):value is string=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const name=(value:unknown):value is string|null=>value===null||typeof value==="string"&&value.trim().length>0&&value.length<=160;
const error=()=>new Error("Biên nhận mở lớp không hợp lệ.");
export function parseClassOpening(value:unknown,scope:ClassOpeningScope):ClassOpeningSnapshot{
  const x=value as {centerId?:string;runningClassId?:string;localDate?:string;state?:string;canConfirm?:boolean;canAppend?:boolean;
    openedByLegalFullName?:string|null;receipt?:{kind?:string;source?:string;receiptId?:string;centerId?:string;runningClassId?:string;localDate?:string;occurrenceKey?:string;openedAt?:string};history?:History[]}|null;
  if(!x||x.centerId!==scope.centerId||x.runningClassId!==scope.runningClassId||x.localDate!==scope.localDate||
    typeof x.canConfirm!=="boolean"||typeof x.canAppend!=="boolean"||!Array.isArray(x.history))throw error();
  if(x.state==="NOT_OPENED"&&x.receipt===null&&x.history.length===0&&!x.canAppend)return {opening:null,canConfirm:x.canConfirm};
  const r=x.receipt;
  if(x.state!=="OPENED"||!r||r.kind!=="CLASS_FIRST_OPENED"||r.source!=="DELIVERY_COMMITTED_OPEN"||
    !uuid.test(r.receiptId??"")||r.centerId!==scope.centerId||r.runningClassId!==scope.runningClassId||r.localDate!==scope.localDate||
    r.occurrenceKey!==scope.runningClassId+":"+scope.localDate||!validTime(r.openedAt)||!name(x.openedByLegalFullName)||
    x.canConfirm||x.history.length<1)throw error();
  const rounds:OpeningRound[]=[],ids=new Set<string>(),assets=new Set<string>();
  let previous:History|undefined;
  for(const e of x.history){
    if(!e||e.version!==(previous?.version??0)+1||!uuid.test(e.eventId)||!uuid.test(e.roundId)||ids.has(e.eventId)||
       !name(e.actorLegalFullName)||!validTime(e.occurredAt)||previous&&e.occurredAt<previous.occurredAt)throw error();
    ids.add(e.eventId);
    if(e.kind==="SUBMISSION"){
      if(e.eventId!==e.roundId||!e.privateAssetId||!uuid.test(e.privateAssetId)||assets.has(e.privateAssetId)||e.verdict!==null||e.reason!==null)throw error();
      assets.add(e.privateAssetId);
      rounds.push({id:e.roundId,submittedBy:e.actorLegalFullName??"—",submittedAt:e.occurredAt,note:"",
        photos:[{id:e.privateAssetId,fileName:"Ảnh setup",preview:"",uploadedAt:e.occurredAt,uploadedBy:e.actorLegalFullName??"—"}],status:"PENDING"});
    }else if(e.kind==="REVIEW"){
      const last=rounds.at(-1);
      if(!last||last.id!==e.roundId||previous?.kind!=="SUBMISSION"||e.privateAssetId!==null||
        (e.verdict!=="APPROVED"&&e.verdict!=="REJECTED")||typeof e.reason!=="string")throw error();
      last.status=e.verdict;last.reviewedAt=e.occurredAt;last.reviewedBy=e.actorLegalFullName??"—";last.reason=e.reason;
    }else throw error();
    previous=e;
  }
  if(!rounds.length)throw error();
  return {canConfirm:false,opening:{receiptId:r.receiptId!,canAppend:x.canAppend,openedAt:r.openedAt,
    openedBy:x.openedByLegalFullName??"—",image:"",fileName:"Ảnh setup",version:x.history.length,rounds}};
}
function photoData(data:string){
  const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if(!m||!m[2]||m[2].length>Math.ceil(2*1024*1024/3)*4)throw new Error("Ảnh setup không hợp lệ hoặc vượt 2 MB.");
  return {mimeType:m[1],base64:m[2]};
}
async function request(path:string,scope:ClassOpeningScope,body?:object,signal?:AbortSignal){
  const res=await fetch(ROOT+path+(body?"":"?"+new URLSearchParams(scope)),{
    method:body?"POST":"GET",cache:"no-store",credentials:"same-origin",...(signal?{signal}:{}),
    ...(body?{headers:{"content-type":"application/json"},body:JSON.stringify({...scope,...body})}:{})});
  if(!res.ok)throw new Error(res.status===403?"Bạn chưa có quyền thao tác mở lớp.":res.status===409?"Thông tin đã thay đổi. Tải lại trước khi thử lại.":"Chưa thể xác minh mở lớp.");
  return (await res.json() as {data?:unknown}).data;
}
export async function readClassOpening(scope:ClassOpeningScope,signal?:AbortSignal){
  return parseClassOpening(await request("",scope,undefined,signal),scope);
}
export async function confirmClassOpening(scope:ClassOpeningScope,data:string){
  const result=parseClassOpening(await request("",scope,{photo:photoData(data)}),scope);
  if(!result.opening)throw error();return result;
}
export async function appendClassOpening(scope:ClassOpeningScope,opening:OpeningRecord,data:string,requestKey:string){
  if(!opening.canAppend||!opening.receiptId||!uuid.test(requestKey))throw error();
  const result=parseClassOpening(await request("/append",scope,{openingReceiptId:opening.receiptId,expectedVersion:opening.version,
    requestKey,photo:photoData(data)}),scope);
  if(!result.opening||result.opening.receiptId!==opening.receiptId||result.opening.version<=opening.version)throw error();
  return result;
}
export async function classOpeningPhoto(scope:ClassOpeningScope,receiptId:string,assetId:string,signal?:AbortSignal){
  if(!uuid.test(receiptId)||!uuid.test(assetId))throw error();
  const query=new URLSearchParams({...scope,openingReceiptId:receiptId,assetId});
  const res=await fetch(ROOT+"/photo?"+query,{cache:"no-store",credentials:"same-origin",...(signal?{signal}:{})});
  if(!res.ok)throw new Error("Không thể xác minh ảnh private.");
  const {data}=await res.json() as {data?:{mimeType?:string;base64?:string}};
  if(!data||!["image/jpeg","image/png","image/webp"].includes(data.mimeType??"")||typeof data.base64!=="string")throw error();
  const uri="data:"+data.mimeType+";base64,"+data.base64;
  photoData(uri);return uri;
}
export function newOpeningRequestKey():string{
  const b=crypto.getRandomValues(new Uint8Array(16));let ms=Date.now();
  for(let i=5;i>=0;i--){b[i]=ms%256;ms=Math.floor(ms/256);}
  b[6]=(b[6]!&15)|112;b[8]=(b[8]!&63)|128;
  const hex=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
  return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
}
