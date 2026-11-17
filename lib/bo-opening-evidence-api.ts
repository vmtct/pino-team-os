/** PAP-764 / PAP-759 draft Core contract. No optimistic UI or local fixtures. */
export type SubjectType="CLASS"|"RECEPTION";
export type EvidenceStatus="PENDING"|"APPROVED"|"REJECTED";
export type OpeningEvidenceRow={
  subjectType:SubjectType;openingReceiptId:string;centerId:string;workDate:string;subjectLabel:string;
  openedAt:string;submittedByLegalFullName:string|null;status:EvidenceStatus;latestRoundId:string;
  version:number;lastModifiedAt:string;lastModifiedByLegalFullName:string|null;canReview:boolean;
};
export type EvidenceEvent={
  eventId:string;version:number;kind:"SUBMISSION"|"REVIEW";roundId:string;actorLegalFullName:string|null;
  occurredAt:string;privateAssetId:string|null;privateAssetIds?:string[];note?:string;verdict:"APPROVED"|"REJECTED"|null;reason:string|null;
};
export type EvidenceDetail={row:OpeningEvidenceRow;history:EvidenceEvent[]};
export type EvidenceListScope={centerId:string;status?:EvidenceStatus;subjectType?:SubjectType;search?:string;startDate?:string;endDate?:string;offset:number;limit:number};
const ROOT="/api/bo/opening-evidence";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const text=(v:unknown):v is string=>typeof v==="string"&&v.length>0;
const instant=(v:unknown):v is string=>text(v)&&Number.isFinite(Date.parse(v));
const name=(v:unknown):v is string|null=>v===null||(typeof v==="string"&&v.trim().length>0&&v.length<=160);
export function parseEvidenceRow(value:unknown,centerId:string):OpeningEvidenceRow{
  const r=value as Partial<OpeningEvidenceRow>|null;
  if(!r||r.centerId!==centerId||!uuid.test(r.openingReceiptId??"")||!uuid.test(r.latestRoundId??"")||
     (r.subjectType!=="CLASS"&&r.subjectType!=="RECEPTION")||!text(r.workDate)||!/^\d{4}-\d{2}-\d{2}$/.test(r.workDate)||
     !text(r.subjectLabel)||!instant(r.openedAt)||!instant(r.lastModifiedAt)||!name(r.submittedByLegalFullName)||
     !name(r.lastModifiedByLegalFullName)||!Number.isSafeInteger(r.version)||r.version!<1||
     !["PENDING","APPROVED","REJECTED"].includes(r.status??"")||typeof r.canReview!=="boolean"||
     (r.canReview&&r.status!=="PENDING"))throw new Error("Biên nhận mở lớp/ca không hợp lệ.");
  return r as OpeningEvidenceRow;
}
export function parseEvidenceDetail(value:unknown,centerId:string,subjectType:SubjectType,id:string):EvidenceDetail{
  const p=value as Partial<EvidenceDetail>|null;
  const row=parseEvidenceRow(p?.row,centerId);
  if(row.subjectType!==subjectType||row.openingReceiptId!==id||!Array.isArray(p?.history)||p.history.length!==row.version)
    throw new Error("Chi tiết không đúng phạm vi.");
  const history=p.history;
  const events=new Set<string>(),assets=new Set<string>();
  for(let i=0;i<history.length;i++){
    const e=history[i];
    if(!e||events.has(e.eventId)||(e.privateAssetId&&assets.has(e.privateAssetId)))throw new Error("Lịch sử bằng chứng không hợp lệ.");
        events.add(e.eventId);
    const photoIds=e.privateAssetIds??(e.privateAssetId?[e.privateAssetId]:[]);
    if(!Array.isArray(photoIds)||photoIds.length>10||
       (e.kind==="SUBMISSION"&&(photoIds.length===0||photoIds[0]!==e.privateAssetId))||
       (e.kind==="REVIEW"&&photoIds.length!==0)||
       (e.note!==undefined&&(typeof e.note!=="string"||e.note.length>1000||(e.kind==="REVIEW"&&e.note!==""))))
      throw new Error("Lịch sử bằng chứng không hợp lệ.");
    for(const asset of photoIds){if(!uuid.test(asset)||assets.has(asset))throw new Error("Lịch sử bằng chứng không hợp lệ.");assets.add(asset);}
    e.privateAssetIds=photoIds;
    if(!e||e.version!==i+1||!uuid.test(e.eventId)||!uuid.test(e.roundId)||!name(e.actorLegalFullName)||!instant(e.occurredAt)||
       (e.kind==="SUBMISSION"?(!e.privateAssetId||!uuid.test(e.privateAssetId)||e.roundId!==e.eventId||e.verdict!==null||e.reason!==null):
       (e.kind!=="REVIEW"||e.privateAssetId!==null||!["APPROVED","REJECTED"].includes(e.verdict??"")||
       typeof e.reason!=="string"||history[i-1]?.kind!=="SUBMISSION"||history[i-1]?.roundId!==e.roundId)))
      throw new Error("Lịch sử bằng chứng không hợp lệ.");
  }
  const last=history.at(-1);
  if(!last||last.roundId!==row.latestRoundId||(last.kind==="SUBMISSION"?"PENDING":last.verdict)!==row.status)
    throw new Error("Trạng thái duyệt không khớp lịch sử.");
  return {row,history};
}
export class OpeningEvidenceApiError extends Error{
  constructor(readonly status:number){super(status===403?"Không có quyền tại cơ sở này.":status===409?"Bản ghi đã thay đổi. Tải lại trước khi duyệt.":"Chưa thể kết nối dữ liệu mở lớp và ca từ Core.");}
}
async function json(url:string,init:RequestInit={}):Promise<unknown>{
  const res=await fetch(url,{...init,cache:"no-store",credentials:"same-origin"});
  if(!res.ok)throw new OpeningEvidenceApiError(res.status);
  const body=await res.json() as {data?:unknown};return body.data;
}
const path=(type:SubjectType,id:string)=>ROOT+"/"+encodeURIComponent(type)+"/"+encodeURIComponent(id);
export const openingEvidenceApi={
  async list(scope:EvidenceListScope,signal?:AbortSignal){
    const q=new URLSearchParams({centerId:scope.centerId,offset:String(scope.offset),limit:String(scope.limit)});
        const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
    if((scope.startDate&&!validDate(scope.startDate))||(scope.endDate&&!validDate(scope.endDate))||(scope.startDate&&scope.endDate&&scope.startDate>scope.endDate))throw new Error("Khoảng ngày không hợp lệ.");
    if(scope.startDate)q.set("startDate",scope.startDate);if(scope.endDate)q.set("endDate",scope.endDate);
    if(scope.status)q.set("status",scope.status);if(scope.subjectType)q.set("subjectType",scope.subjectType);if(scope.search)q.set("search",scope.search);
    const result=await json(ROOT+"?"+q,signal?{signal}:{}) as {rows?:unknown[];total?:number}|null;
    if(!result||!Array.isArray(result.rows)||!Number.isSafeInteger(result.total)||result.total!<result.rows.length||result.rows.length>scope.limit)
      throw new Error("Danh sách mở lớp và ca không hợp lệ.");
    const rows=result.rows.map(r=>parseEvidenceRow(r,scope.centerId));
    if(rows.some(r=>(scope.status&&r.status!==scope.status)||(scope.subjectType&&r.subjectType!==scope.subjectType)||(scope.startDate&&r.workDate<scope.startDate)||(scope.endDate&&r.workDate>scope.endDate)))
      throw new Error("Danh sách không đúng bộ lọc.");
    return {rows,total:result.total!};
  },
  async detail(centerId:string,type:SubjectType,id:string,signal?:AbortSignal){
    return parseEvidenceDetail(await json(path(type,id)+"?"+new URLSearchParams({centerId}),signal?{signal}:{}),centerId,type,id);
  },
  async review(row:OpeningEvidenceRow,verdict:"APPROVED"|"REJECTED",reason:string,requestKey:string){
    if(!row.canReview||row.status!=="PENDING"||!uuid.test(requestKey)||(verdict==="REJECTED"&&reason.trim().length<8)||reason.trim().length>1000)
      throw new Error("Không đủ điều kiện duyệt.");
    const result=await json(path(row.subjectType,row.openingReceiptId)+"/review",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({centerId:row.centerId,expectedVersion:row.version,roundId:row.latestRoundId,verdict,reason:reason.trim(),requestKey})}) as {outcome?:string;event?:{version?:number;round_id?:string;verdict?:string}}|null;
    if((result?.outcome!=="CREATED"&&result?.outcome!=="REPLAYED")||result.event?.version!==row.version+1||
       result.event.round_id!==row.latestRoundId||result.event.verdict!==verdict)throw new Error("Chưa xác minh được quyết định duyệt.");
  },
  async photo(row:OpeningEvidenceRow,assetId:string,signal?:AbortSignal){
    if(!uuid.test(assetId))throw new Error("Ảnh không hợp lệ.");
    const res=await fetch(path(row.subjectType,row.openingReceiptId)+"/photo/"+encodeURIComponent(assetId)+"?"+new URLSearchParams({centerId:row.centerId}),
      {credentials:"same-origin",cache:"no-store",...(signal?{signal}:{})});
    if(!res.ok)throw new OpeningEvidenceApiError(res.status);
    const blob=await res.blob();
    if(!["image/jpeg","image/png","image/webp"].includes(blob.type)||blob.size<1||blob.size>2*1024*1024)throw new Error("Ảnh không hợp lệ.");
    return blob;
  },
};
/** UUIDv7 only for client idempotency, never a domain record ID. */
export function newReviewRequestKey():string{
  const b=crypto.getRandomValues(new Uint8Array(16));let ms=Date.now();
  for(let i=5;i>=0;i--){b[i]=ms%256;ms=Math.floor(ms/256);}
  b[6]=(b[6]!&15)|112;b[8]=(b[8]!&63)|128;
  const h=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
