/** PAP-2032 / PNR-WISH — BO event readback and reversal request contract, unmounted. */
import {parseWishReceipt} from "./pls-wish-tos-contract";
type Row=Record<string,unknown>;
const fail=():never=>{throw Error("Dữ liệu sự kiện Wish không hợp lệ hoặc đã thay đổi.");};
function object(v:unknown):Row{if(!v||typeof v!=="object"||Array.isArray(v))return fail();return v as Row;}
function id(v:unknown):string{if(typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v))return fail();return v;}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)return fail();return v;}
function text(v:unknown,max=160):string{if(typeof v!=="string"||!v.trim()||v.length>max)return fail();return v;}
function label(v:unknown):string|null{if(v===null)return null;if(typeof v!=="string")return fail();return v.trim()||null;}
function time(v:unknown):string{if(typeof v!=="string"||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)return fail();return v;}
export function parseBoWishEvent(raw:unknown,scope:{centerId:string;learnerId?:string}){
 const r=object(raw),centerId=id(r.centerId),learnerId=id(r.learnerId);
 if(centerId!==scope.centerId||(scope.learnerId!==undefined&&learnerId!==scope.learnerId))return fail();
 const count=integer(r.count,1,10),unitCost=integer(r.unitCost,1,1000000),spent=integer(r.spent,1),balanceBefore=integer(r.balanceBefore),balanceAfter=integer(r.balanceAfter);
 if(spent!==count*unitCost||balanceBefore-balanceAfter!==spent)return fail();
 const highestRarity=r.highestRarity,status=r.status,learnerGender=r.learnerGender;
 if((highestRarity!==3&&highestRarity!==4&&highestRarity!==5)||(status!=="COMMITTED"&&status!=="INVALIDATED")||(learnerGender!==null&&learnerGender!=="MALE"&&learnerGender!=="FEMALE"))return fail();
 const createdAt=time(r.createdAt);
 const reversedAt=r.reversedAt===null?null:time(r.reversedAt),reversedBy=r.reversedBy===null?null:id(r.reversedBy),reversalReason=r.reversalReason===null?null:text(r.reversalReason,1000);
 if(status==="COMMITTED"?(reversedAt!==null||reversedBy!==null||reversalReason!==null):(!reversedAt||!reversedBy||!reversalReason||reversedAt<createdAt))return fail();
 return {eventId:id(r.eventId),learnerId,selfId:id(r.selfId),centerId,actorUserId:id(r.actorUserId),visitId:id(r.visitId),createdAt,count,unitCost,spent,balanceBefore,balanceAfter,policyRevisionId:id(r.policyRevisionId),bannerRevisionId:id(r.bannerRevisionId),familyId:text(r.familyId),highestRarity,status,reversedAt,reversedBy,reversalReason,learnerName:label(r.learnerName),learnerGender,centerName:label(r.centerName),actorName:label(r.actorName),reversedByName:label(r.reversedByName),policyName:label(r.policyName),bannerName:label(r.bannerName)};
}
export type BoWishEvent=ReturnType<typeof parseBoWishEvent>;
export function parseBoWishList(raw:unknown,scope:{centerId:string;learnerId?:string},limit:number,before?:{createdAt:string;eventId:string}){
 integer(limit,1,100);if(!Array.isArray(raw)||raw.length>limit)return fail();
 const rows=raw.map(v=>parseBoWishEvent(v,scope)),seen=new Set<string>();
 let previous=before;
 for(const row of rows){
  if(seen.has(row.eventId)||previous&&(row.createdAt>previous.createdAt||row.createdAt===previous.createdAt&&row.eventId>=previous.eventId))return fail();
  seen.add(row.eventId);previous=row;
 }
 return rows;
}
export function parseBoWishDetail(raw:unknown,centerId:string,eventId:string){
 const r=object(raw),event=parseBoWishEvent(r,{centerId});
 if(event.eventId!==eventId||!Array.isArray(r.outcomes))return fail();
 const receipt=parseWishReceipt({...r,replayed:false},{centerId,learnerId:event.learnerId,bannerRevisionId:event.bannerRevisionId,policyRevisionId:event.policyRevisionId,expectedCost:event.unitCost,count:event.count});
 if(receipt.highestRarity!==event.highestRarity)return fail();
 const outcomes=receipt.outcomes.map((o,i)=>{const source=object((r.outcomes as unknown[])[i]);const provenance=source.provenance;if(provenance!==(o.duplicate?null:"WISH_DRAW"))return fail();return {...o,itemName:label(source.itemName),provenance:provenance as "WISH_DRAW"|null};});
 return {...event,outcomes};
}
export type BoWishDetail=ReturnType<typeof parseBoWishDetail>;
export const wishImmutableIdentity=(e:BoWishDetail)=>JSON.stringify([e.eventId,e.centerId,e.learnerId,e.selfId,e.visitId,e.actorUserId,e.createdAt,e.policyRevisionId,e.bannerRevisionId,e.familyId,e.count,e.unitCost,e.spent,e.balanceBefore,e.balanceAfter,e.highestRarity,e.outcomes.map(o=>[o.ordinal,o.itemId,o.itemRevision,o.rarity,o.duplicate,o.grantEventId,o.provenance])]);
// Impact summary is advisory only; Core revalidates dependencies atomically.
export function prepareWishInvalidation(event:BoWishDetail,reason:string,key:string=crypto.randomUUID()){
 if(event.status!=="COMMITTED"||key!==key.trim()||!key||key.length>256)return fail();
 const body=Object.freeze({eventId:event.eventId,centerId:event.centerId,reason:text(reason.trim(),1000)});
 return Object.freeze({key,body,originalIdentity:wishImmutableIdentity(event),expectedRefund:event.spent,affectedGrants:Object.freeze(event.outcomes.filter(o=>!o.duplicate).map(o=>o.grantEventId))});
}
export function confirmWishInvalidation(attempt:ReturnType<typeof prepareWishInvalidation>,receipt:unknown,readback:unknown,original:BoWishDetail){
 const r=object(receipt);
 if(id(r.eventId)!==attempt.body.eventId||integer(r.refund)!==attempt.expectedRefund||r.reason!==attempt.body.reason||typeof r.replayed!=="boolean")return fail();
 const detail=parseBoWishDetail(readback,attempt.body.centerId,attempt.body.eventId);
 if(detail.status!=="INVALIDATED"||detail.reversalReason!==attempt.body.reason||detail.spent!==attempt.expectedRefund)return fail();
 if(wishImmutableIdentity(detail)!==attempt.originalIdentity||wishImmutableIdentity(original)!==attempt.originalIdentity||JSON.stringify(detail.outcomes.filter(o=>!o.duplicate).map(o=>o.grantEventId))!==JSON.stringify(attempt.affectedGrants))return fail();
 return detail;
}
