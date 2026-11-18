/** PAP-2032 / PAP-2092: strict staging BO PLS Wish facade. Core remains authorization authority. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {boPlsWishHostDecision} from "./bo-pls-wish-host-contract";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
export interface BoPlsWishEnv extends TeamAccessEnv{APP_ENV?:string;PINO_BO_CORE:BoAccessCoreBinding}
const root="/api/bo/pinoria/pls-wish/events";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
const fail=(status:number,code="INVALID_WISH_EVENT_REQUEST")=>Response.json({error:{code}},{status,headers});
async function reasonBody(r:Request):Promise<string>{
 if(!/^application\/json(?:\s*;|$)/i.test(r.headers.get("content-type")??""))throw Error("JSON_REQUIRED");
 const reader=r.body?.getReader();if(!reader)throw Error("BODY_REQUIRED");
 let size=0,raw="";const decoder=new TextDecoder("utf-8",{fatal:true});
 try{for(;;){const c=await reader.read();if(c.done)break;size+=c.value.byteLength;if(size>8192){await reader.cancel();throw Error("BODY_TOO_LARGE");}raw+=decoder.decode(c.value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
 const input:unknown=JSON.parse(raw);
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==1||!("reason" in input)||typeof input.reason!=="string"||!input.reason.trim()||input.reason.trim().length>1000)throw Error("INVALID_REASON");
 return input.reason.trim();
}
export async function handleBoPlsWishEvent(r:Request,env:BoPlsWishEnv){
 const u=new URL(r.url),m=r.method.toUpperCase();
 if((u.pathname!==root&&!u.pathname.startsWith(root+"/"))||env.APP_ENV!=="staging"||boPlsWishHostDecision(u.hostname,u.pathname,m)!=="next")return fail(404,"NOT_FOUND");
 const path=u.pathname===root?[]:u.pathname.slice(root.length+1).split("/"),list=!path.length,query=u.searchParams;
 const reward=path.length===3&&path[1]==="reward-media";
 if(reward&&(!uuid.test(r.headers.get("x-pino-expected-actor")??"")||r.headers.has("idempotency-key")))return fail(400);
 const allowed=list?["centerId","limit","learnerId","beforeCreatedAt","beforeEventId"]:["centerId"];
 for(const k of query.keys())if(!allowed.includes(k)||query.getAll(k).length!==1)return fail(400);
 const centerId=query.get("centerId");if(!centerId||!uuid.test(centerId))return fail(400);
 const outbound:BoAccessRequest={method:m,path:["pinoria/pls-wish/events",...path].join("/"),resource:{centerId}};
 if(list){
  const limitText=query.get("limit")??"50",learnerId=query.get("learnerId"),createdAt=query.get("beforeCreatedAt"),eventId=query.get("beforeEventId");
  if(!/^[1-9][0-9]{0,2}$/.test(limitText)||Number(limitText)>100||learnerId!==null&&!uuid.test(learnerId)||((createdAt===null)!==(eventId===null)))return fail(400);
  if(createdAt!==null&&(!eventId||!uuid.test(eventId)||!Number.isFinite(Date.parse(createdAt))||new Date(createdAt).toISOString()!==createdAt))return fail(400);
  outbound.body={limit:Number(limitText),...(learnerId?{learnerId}:{}),...(createdAt&&eventId?{before:{createdAt,eventId}}:{})};
 }
 if(m==="POST"){
  const expectedActor=r.headers.get("x-pino-expected-actor");if(!expectedActor||!uuid.test(expectedActor))return fail(400);
  const key=r.headers.get("idempotency-key");if(!key||key!==key.trim()||key.length>256)return fail(400);
  let reason:string;try{reason=await reasonBody(r);}catch{return fail(400);}
  outbound.idempotencyKey=key;outbound.body={reason};
 }
 try{
  const credential=await teamCredential(r,env,"BO");
  if(credential.kind==="support")return fail(403,"ACCESS_PERMISSION_DENIED");
  if(!env.PINO_BO_CORE)return fail(503,"WISH_UNAVAILABLE");
  if(m==="POST"||reward){
   const ctx=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"GET",path:"context",resource:{centerId}},credential);
   if(ctx.status!==200)return fail(ctx.status,"ACCESS_PERMISSION_DENIED");
   const value=(ctx.body as {data?:{userId?:unknown;surface?:unknown;entitled?:unknown;permissionKeys?:unknown}}|null)?.data;
   if(!value||value.userId!==r.headers.get("x-pino-expected-actor")||value.surface!=="BO"||value.entitled!==true||!Array.isArray(value.permissionKeys)||!value.permissionKeys.includes("pinoria.wish_event.view")||(m==="POST"&&!value.permissionKeys.includes("pinoria.wish_event.invalidate")))return fail(403,"ACCESS_PERMISSION_DENIED");
  }
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,outbound,credential);
  return Response.json(result.body,{status:result.status,headers:{...headers,"x-request-id":result.requestId}});
 }catch(e){return fail(e instanceof TeamAuthError?e.status:503,"WISH_UNAVAILABLE");}
}
