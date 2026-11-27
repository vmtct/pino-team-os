/** PAP-2031 PNR-WISH: exact staging-only TOS ingress, never legacy ENERGY_SEED. */
import {normalizeHostname,TOS_STAGING_HOSTNAME} from "./host-boundary";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {callTosLearningCoreWithStaffPassword,type TosLearningCoreBinding} from "./tos-learning-core";
import type {StaffPasswordCoreBinding} from "./staff-password-core";
type Env=TeamAccessEnv&{APP_ENV?:string;PINO_TOS_LEARNING_CORE?:TosLearningCoreBinding;PINO_STAFF_PASSWORD_CORE?:Pick<StaffPasswordCoreBinding,"status">};
const prefix="/api/tos-learning/pinoria/pls-wish/";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isId=(x:unknown):x is string=>typeof x==="string"&&uuid.test(x);
const max=8192;
const isDate=(x:unknown):x is string=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00.000Z"))&&new Date(x+"T00:00:00.000Z").toISOString().slice(0,10)===x;
const json=(status:number,body:unknown,requestId?:string)=>Response.json(body,{status,headers:{"cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}});
const fail=(status:number,code:string)=>json(status,{error:{code,message:"Không thể xác minh yêu cầu Wish."}});
async function boundedJson(r:Request):Promise<unknown>{
 const size=Number(r.headers.get("content-length")??0);
 if(!Number.isSafeInteger(size)||size<0||size>max)throw new RangeError();
 if(!r.body)throw new SyntaxError();
 const reader=r.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});let raw="",n=0;
 try{for(;;){const part=await reader.read();if(part.done)break;n+=part.value.byteLength;if(n>max){await reader.cancel();throw new RangeError();}raw+=decoder.decode(part.value,{stream:true});}return JSON.parse(raw+decoder.decode()) as unknown;}
 finally{reader.releaseLock();}
}
export async function handleTosPlsWish(r:Request,env:Env){
 const u=new URL(r.url),action=u.pathname.slice(prefix.length);
 if(env.APP_ENV!=="staging"||normalizeHostname(u.hostname)!==TOS_STAGING_HOSTNAME||normalizeHostname(r.headers.get("host")??"")!==TOS_STAGING_HOSTNAME||!u.pathname.startsWith(prefix)||!["session","quote","draw","reveal","reception-count"].includes(action))return fail(404,"NOT_FOUND");
 const draw=action==="draw",method=draw?"POST":"GET";
 if(r.method!==method)return fail(405,"METHOD_NOT_ALLOWED");
 try{
  const credential=await teamCredential(r,env,"TOS");if(credential.kind!=="password")return fail(403,"ACCESS_PERMISSION_DENIED");
  if(!env.PINO_STAFF_PASSWORD_CORE)return fail(503,"WISH_UNAVAILABLE");
  let session:Awaited<ReturnType<StaffPasswordCoreBinding["status"]>>;try{session=await env.PINO_STAFF_PASSWORD_CORE.status(credential.token);}catch{return fail(401,"AUTH_REQUIRED");}
  if(!session||!isId(session.userId)||!isId(session.staffMemberId)||session.passwordChangeRequired!==false)return fail(403,"ACCESS_PERMISSION_DENIED");
  if(action==="session"){if(u.search||r.headers.has("idempotency-key"))return fail(400,"INVALID_INPUT");return json(200,{data:{actorId:session.userId}});}
  if(r.headers.get("x-pino-expected-actor")!==session.userId)return fail(403,"ACCESS_PERMISSION_DENIED");
  const binding=env.PINO_TOS_LEARNING_CORE;if(!binding||typeof binding.executeWithStaffPassword!=="function")return fail(503,"WISH_UNAVAILABLE");
  let body:Record<string,unknown>,key:string|undefined;
  if(draw){
   if(u.search||!/^application\/json(?:\s*;|$)/i.test(r.headers.get("content-type")??""))return fail(400,"INVALID_INPUT");
   key=r.headers.get("idempotency-key")??undefined;if(!key||!key.trim()||key!==key.trim()||key.length>256)return fail(400,"INVALID_INPUT");
   const raw=await boundedJson(r);if(!raw||typeof raw!=="object"||Array.isArray(raw))return fail(400,"INVALID_INPUT");
   body=raw as Record<string,unknown>;
   const keys=["centerId","learnerId","policyRevisionId","bannerRevisionId","expectedCost","count"];
   if(Object.keys(body).length!==keys.length||keys.some(k=>!Object.hasOwn(body,k))||!keys.slice(0,4).every(k=>isId(body[k]))||!Number.isSafeInteger(body.count)||Number(body.count)<1||Number(body.count)>10||!Number.isSafeInteger(body.expectedCost)||Number(body.expectedCost)<1||Number(body.expectedCost)>1000000)return fail(400,"INVALID_INPUT");
  }else{
   if(r.headers.has("idempotency-key"))return fail(400,"INVALID_INPUT");
   const keys=action==="reception-count"?["centerId","workDate"]:action==="quote"?["centerId","learnerId"]:["centerId","learnerId","eventId"];
   const entries=[...u.searchParams.entries()];if(entries.length!==keys.length||keys.some(k=>u.searchParams.getAll(k).length!==1||!(k==="workDate"?isDate(u.searchParams.get(k)):isId(u.searchParams.get(k)))))return fail(400,"INVALID_INPUT");
   body=Object.fromEntries(entries);
  }
  const result=await callTosLearningCoreWithStaffPassword(binding,{method,path:"/pinoria/pls-wish/"+action,body,...(key?{idempotencyKey:key}:{})},credential.token);
  return json(result.status,result.body,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return fail(e.status,"AUTH_REQUIRED");if(e instanceof RangeError)return fail(413,"PAYLOAD_TOO_LARGE");if(e instanceof SyntaxError||e instanceof TypeError)return fail(400,"INVALID_INPUT");return fail(503,"WISH_UNAVAILABLE");}
}
