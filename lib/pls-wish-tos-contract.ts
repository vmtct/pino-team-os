/** PAP-2031 / PNR-WISH — local TOS confirmation contract; no route or writer. */
const canonicalId = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Scope = Readonly<{centerId:string;learnerId:string}>;
type Banner = Readonly<{bannerId:string;bannerRevisionId:string;policyRevisionId:string;centerId:string|null;familyId:string;name:string;unitCost:number;maxCount:number;pity:Readonly<{since4:number;since5:number;guarantee:boolean}>}>;
type Quote = Readonly<Scope & {balance:number;visitId:string|null;status:"READY"|"SELF_REQUIRED"|"OPEN_VISIT_REQUIRED"|"NO_ACTIVE_CONFIGURATION";banners:readonly Banner[]}>;
export type WishDrawPayload = Readonly<Scope & {policyRevisionId:string;bannerRevisionId:string;expectedCost:number;count:number}>;
function fail():never {throw new Error("Dữ liệu xác nhận Wish không hợp lệ hoặc đã thay đổi.");}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))return fail();return v as Record<string,unknown>;}
function id(v:unknown):string{if(typeof v!=="string"||!canonicalId.test(v))return fail();return v;}
function integer(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)return fail();return v;}
export function parseWishQuote(raw:unknown,scope:Scope):Quote {
 const r=obj(raw), centerId=id(r.centerId), learnerId=id(r.learnerId);
 if(centerId!==scope.centerId||learnerId!==scope.learnerId)return fail();
 const balance=integer(r.balance,0),visitId=r.visitId===null?null:id(r.visitId);
 const status=r.status;
 if(status!=="READY"&&status!=="SELF_REQUIRED"&&status!=="OPEN_VISIT_REQUIRED"&&status!=="NO_ACTIVE_CONFIGURATION")return fail();
 if(!Array.isArray(r.banners))return fail();
 if(status==="READY"?(!visitId||r.banners.length===0):r.banners.length!==0)return fail();
 if(status==="OPEN_VISIT_REQUIRED"&&visitId!==null)return fail();
 if(status==="NO_ACTIVE_CONFIGURATION"&&!visitId)return fail();
 const banners=r.banners.map((rawBanner):Banner=>{
  const b=obj(rawBanner), bannerCenter=b.centerId===null?null:id(b.centerId);
  if(bannerCenter!==null&&bannerCenter!==centerId)return fail();
  if(typeof b.name!=="string"||!b.name.trim()||typeof b.familyId!=="string"||!b.familyId.trim()||b.familyId!==b.familyId.trim()||b.familyId.length>160)return fail();
  const unitCost=integer(b.unitCost,1,1000000),maxCount=integer(b.maxCount,0,10);
  if(maxCount!==Math.min(10,Math.floor(balance/unitCost)))return fail();
  const pity=obj(b.pity),since4=integer(pity.since4,0),since5=integer(pity.since5,since4);
  if(typeof pity.guarantee!=="boolean")return fail();
  return {bannerId:id(b.bannerId),bannerRevisionId:id(b.bannerRevisionId),policyRevisionId:id(b.policyRevisionId),familyId:b.familyId,centerId:bannerCenter,name:b.name,unitCost,maxCount,pity:{since4,since5,guarantee:pity.guarantee}};
 });
 if(new Set(banners.map(b=>b.bannerId)).size!==banners.length||new Set(banners.map(b=>b.bannerRevisionId)).size!==banners.length||new Set(banners.map(b=>b.policyRevisionId)).size>1)return fail();
 return {centerId,learnerId,balance,visitId,status,banners};
}
export function prepareWishConfirmation(raw:unknown,scope:Scope,bannerRevisionId:string,count:number|"MAX"):Readonly<{payload:WishDrawPayload;totalCost:number;quotedBalance:number;visitId:string}>{
 const q=parseWishQuote(raw,scope);
 if(q.status!=="READY"||!q.visitId)return fail();
 const b=q.banners.find(x=>x.bannerRevisionId===bannerRevisionId);
 if(!b)return fail();
 const n=integer(count==="MAX"?b.maxCount:count,1,b.maxCount);
 return {payload:{centerId:q.centerId,learnerId:q.learnerId,policyRevisionId:b.policyRevisionId,bannerRevisionId:b.bannerRevisionId,expectedCost:b.unitCost,count:n},totalCost:n*b.unitCost,quotedBalance:q.balance,visitId:q.visitId};
}

// The receipt is the committed server result, never a client-side draw.
export type WishOutcome=Readonly<{ordinal:number;itemId:string;itemRevision:number;rarity:3|4|5;duplicate:boolean;grantEventId:string|null}>;
export function parseWishReceipt(raw:unknown,expected:WishDrawPayload){
 const r=obj(raw);
 if(id(r.policyRevisionId)!==expected.policyRevisionId||id(r.bannerRevisionId)!==expected.bannerRevisionId||integer(r.count,1,10)!==expected.count||integer(r.unitCost,1,1000000)!==expected.expectedCost)return fail();
 const eventId=id(r.eventId),balanceBefore=integer(r.balanceBefore,0),balanceAfter=integer(r.balanceAfter,0);
 if(balanceBefore-balanceAfter!==expected.expectedCost*expected.count||typeof r.replayed!=="boolean"||!Array.isArray(r.outcomes)||r.outcomes.length!==expected.count)return fail();
 const grants=new Set<string>(),newItems=new Set<string>();
 let previous:{since4:number;since5:number;featured:number}|undefined;
 const outcomes=r.outcomes.map((rawOutcome,i):WishOutcome=>{
  const o=obj(rawOutcome),ordinal=integer(o.ordinal,1,10),itemId=id(o.item_id),itemRevision=integer(o.item_revision,1),rarity=o.rarity;
  if(ordinal!==i+1||(rarity!==3&&rarity!==4&&rarity!==5)||(o.duplicate!==0&&o.duplicate!==1))return fail();
  const duplicate=o.duplicate===1,grantEventId=o.grant_event_id===null?null:id(o.grant_event_id);
  if(duplicate?grantEventId!==null:!grantEventId||grants.has(grantEventId)||newItems.has(itemId))return fail();
  if(grantEventId){grants.add(grantEventId);newItems.add(itemId);}
  const before4=integer(o.before4,0),before5=integer(o.before5,before4),beforeFeatured=integer(o.before_featured,0,1);
  const after4=integer(o.after4,0),after5=integer(o.after5,after4),afterFeatured=integer(o.after_featured,0,1);
  if(previous&&(previous.since4!==before4||previous.since5!==before5||previous.featured!==beforeFeatured))return fail();
  previous={since4:after4,since5:after5,featured:afterFeatured};
  return {ordinal,itemId,itemRevision,rarity,duplicate,grantEventId};
 });
 return {eventId,balanceBefore,balanceAfter,unitCost:expected.expectedCost,count:expected.count,policyRevisionId:expected.policyRevisionId,bannerRevisionId:expected.bannerRevisionId,replayed:r.replayed,outcomes,highestRarity:Math.max(...outcomes.map(o=>o.rarity)) as 3|4|5};
}
export type WishAttempt=Readonly<{key:string;payload:WishDrawPayload}>;
export function createWishAttempt(payload:WishDrawPayload,key:string=crypto.randomUUID()):WishAttempt{
 // Reuse the same attempt on ambiguous network failure; never allocate a second key automatically.
 if(!key.trim()||key!==key.trim()||key.length>256)return fail();
 return Object.freeze({key,payload:Object.freeze({...payload})});
}
export function wishAttemptRequest(attempt:WishAttempt):RequestInit{
 return {method:"POST",cache:"no-store",credentials:"same-origin",headers:{"content-type":"application/json","idempotency-key":attempt.key},body:JSON.stringify(attempt.payload)};
}
