/** PAP-2371: feature-specific HO facade; Core remains the authorization and mutation authority. */
import {authorizeHoShell} from "./ho-auth";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredentialFromHeaders} from "./team-auth";
import {BoShellGateError} from "./bo-shell-gate";
import type {HoWorldEnv} from "./ho-world-handler";
import {learningSpaceRoute,type Route} from "./ho-learning-space-contract";
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const permission="delivery.schedule.manage",max=4096;
function json(status:number,body:unknown,requestId?:string){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string)=>json(status,{error:{code,message:"Learning Space request unavailable"}});
function validQuery(u:URL,r:Route){
 const allowed=r.kind==="list"?["q","centerId","status","after","limit"]:r.kind==="related"?["after","limit"]:[];
 for(const k of u.searchParams.keys()){
  const v=u.searchParams.get(k);
  if(v===null||!allowed.includes(k)||u.searchParams.getAll(k).length!==1)return false;
  if(k==="q"&&(v.length>120||[...v].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))return false;
  if((k==="centerId"||k==="after")&&!id.test(v)||k==="status"&&!["ACTIVE","INACTIVE","ARCHIVED"].includes(v)||k==="limit"&&(!/^[1-9][0-9]{0,2}$/.test(v)||Number(v)>100))return false;
 }
 return true;
}
async function payload(req:Request,r:Route){
 const length=Number(req.headers.get("content-length")??0);
 if(!Number.isSafeInteger(length)||length<0||length>max)throw new RangeError();
 if(!req.body)throw new SyntaxError();
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>max){await reader.cancel();throw new RangeError();}chunks.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let value:unknown;try{value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{throw new SyntaxError();}
 if(value===null||typeof value!=="object"||Array.isArray(value))throw new SyntaxError();
 const b=value as Record<string,unknown>,fields=["centerId","code","displayName","optimalConcurrentCapacity","hardConcurrentCapacity","status"],allowed=r.kind==="remove"?["centerId","expectedVersion"]:r.kind==="update"?[...fields,"expectedVersion"]:fields;
 if(Object.keys(b).length!==allowed.length||Object.keys(b).some(k=>!allowed.includes(k))||typeof b.centerId!=="string"||!id.test(b.centerId))throw new SyntaxError();
 const positive=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
 if(r.kind!=="create"&&!positive(b.expectedVersion))throw new SyntaxError();
 if(r.kind!=="remove"&&(typeof b.code!=="string"||!b.code.trim()||b.code.length>64||typeof b.displayName!=="string"||!b.displayName.trim()||b.displayName.length>200||!positive(b.optimalConcurrentCapacity)||b.hardConcurrentCapacity!==null&&(!positive(b.hardConcurrentCapacity)||b.hardConcurrentCapacity<b.optimalConcurrentCapacity)||!["ACTIVE","INACTIVE","ARCHIVED"].includes(String(b.status))))throw new SyntaxError();
 return b;
}
export async function handleHoLearningSpaceRequest(req:Request,env:HoWorldEnv):Promise<Response>{
 const u=new URL(req.url);
 if(env.APP_ENV!=="staging"||u.protocol!=="https:"||normalizeHostname(u.hostname)!==HO_STAGING_HOSTNAME||normalizeHostname(req.headers.get("host")??"")!==HO_STAGING_HOSTNAME)return fail(404,"NOT_FOUND");
 const r=learningSpaceRoute(u.pathname,req.method);
 if(!r)return fail(404,"NOT_FOUND");
 if(!validQuery(u,r))return fail(400,"INVALID_INPUT");
 const writing=r.method!=="GET";
 if(writing&&req.headers.get("origin")!==u.origin)return fail(403,"INVALID_ORIGIN");
 if(!writing&&(req.body||req.headers.has("idempotency-key")))return fail(400,"INVALID_INPUT");
 try{
  const actor=await authorizeHoShell(req.headers,env);
  if(!actor.permissionKeys.includes(permission))return fail(403,"ACCESS_PERMISSION_DENIED");
  const credential=await teamCredentialFromHeaders(req.headers,env,"BO");
  if(credential.kind!=="password")return fail(401,"AUTH_REQUIRED");
  if(!env.PINO_HO_WORLD_CORE||typeof env.PINO_HO_WORLD_CORE.executeWithStaffPassword!=="function")return fail(503,"HO_SPACE_UNAVAILABLE");
  let body:unknown,k:string|undefined;
  if(writing){
   k=req.headers.get("idempotency-key")??"";
   if(k.length<8||k.length>160||k!==k.trim())return fail(400,"INVALID_IDEMPOTENCY");
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")??""))return fail(415,"UNSUPPORTED_MEDIA_TYPE");
   body=await payload(req,r);
  }
  const result=await env.PINO_HO_WORLD_CORE.executeWithStaffPassword({method:r.method,path:"ho/learning-spaces"+r.suffix+u.search,...(writing?{body,idempotencyKey:k}: {})},credential.token);
  if(result.status!==200&&result.status!==201){
   const allowed=[400,401,403,404,405,409,413,415,429,503],status=allowed.includes(result.status)?result.status:503;
   return fail(status,status===409?"LEARNING_SPACE_CONFLICT":status===401?"AUTH_REQUIRED":status===403?"ACCESS_PERMISSION_DENIED":status===404?"NOT_FOUND":status===400?"INVALID_INPUT":"HO_SPACE_UNAVAILABLE");
  }
  if(result.status!==(r.kind==="create"?201:200))return fail(503,"HO_SPACE_UNAVAILABLE");
  return json(result.status,result.body,result.requestId);
 }catch(e){if(e instanceof RangeError)return fail(413,"PAYLOAD_TOO_LARGE");if(e instanceof SyntaxError)return fail(400,"INVALID_BODY");if(e instanceof BoShellGateError)return fail(e.status,"HO_ACCESS_DENIED");return fail(503,"HO_SPACE_UNAVAILABLE");}
}
