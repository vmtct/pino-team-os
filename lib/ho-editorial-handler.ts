/** PAP-2404: unmounted private HO Editorial facade; Core owns all decisions. */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredentialFromHeaders} from "./team-auth";
import {BoShellGateError} from "./bo-shell-gate";
type EditorialRequest={method:string;path:string;body?:unknown;idempotencyKey?:string};
type EditorialResult={status:number;body:unknown;requestId:string};
export interface HoEditorialEnv extends HoEnv{
 PINO_HO_EDITORIAL_CORE?:{executeWithStaffPassword(request:EditorialRequest,token:string):Promise<EditorialResult>};
}
const root="/api/ho/learning/piner-posts/editorial",core="ho/learning/piner-posts/editorial";
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const key=/^[A-Za-z0-9_-]{16,128}$/,max=8192;
function json(status:number,body:unknown,requestId?:string){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string)=>json(status,{error:{code,message:"Editorial request unavailable"}});
type Kind="queue"|"detail"|"history"|"decision";
function route(path:string):{kind:Kind;suffix:string}|null{
 if(path===root)return {kind:"queue",suffix:""};
 if(!path.startsWith(root+"/"))return null;
 const suffix=path.slice(root.length),parts=suffix.slice(1).split("/");
 if(suffix==="/decision")return {kind:"decision",suffix};
 if(parts.length===1&&id.test(parts[0]!))return {kind:"detail",suffix};
 if(parts.length===2&&id.test(parts[0]!)&&parts[1]==="history")return {kind:"history",suffix};
 return null;
}
function validQuery(u:URL,kind:Kind){
 const allowed=kind==="queue"?["centerId","status","limit","offset"]:kind==="history"?["centerId","limit","offset"]:kind==="detail"?["centerId"]:[];
 for(const k of u.searchParams.keys()){
  const v=u.searchParams.get(k)!;
  if(!allowed.includes(k)||u.searchParams.getAll(k).length!==1)return false;
  if(k==="limit"&&(!/^[1-9][0-9]*$/.test(v)||Number(v)>50)||k==="offset"&&(!/^(0|[1-9][0-9]*)$/.test(v)||Number(v)>10000))return false;
 }
 if(kind==="decision")return true;
 if(!id.test(u.searchParams.get("centerId")??""))return false;
 return kind!=="queue"||["PENDING_APPROVAL","PUBLISHED","HIDDEN"].includes(u.searchParams.get("status")??"");
}
async function payload(req:Request){
 const length=req.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw new RangeError();
 if(!req.body)throw new SyntaxError();
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>max){await reader.cancel();throw new RangeError();}chunks.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const value:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 if(!value||typeof value!=="object"||Array.isArray(value))throw new SyntaxError();
 const v=value as Record<string,unknown>,base=["action","centerId","postId","expectedVersion"];
 const exact=(extra:string[])=>Object.keys(v).length===base.length+extra.length&&[...base,...extra].every(k=>Object.hasOwn(v,k));
 if(typeof v.centerId!=="string"||!id.test(v.centerId)||typeof v.postId!=="string"||!id.test(v.postId)||typeof v.expectedVersion!=="number"||!Number.isSafeInteger(v.expectedVersion)||v.expectedVersion<2||v.expectedVersion>=Number.MAX_SAFE_INTEGER)throw new SyntaxError();
 if(v.action==="HIDE"&&exact([]))return v;
 if(v.action==="RETURN"&&exact(["returnReason"])&&typeof v.returnReason==="string"&&v.returnReason.trim().length>0&&v.returnReason.trim().length<=2000)return v;
 if((v.action==="PUBLISH"||v.action==="REPUBLISH")&&exact(["caption","attachmentIds"])&&typeof v.caption==="string"&&v.caption.trim()&&v.caption.length<=2000&&Array.isArray(v.attachmentIds)&&v.attachmentIds.length>=1&&v.attachmentIds.length<=5&&v.attachmentIds.every(x=>typeof x==="string"&&id.test(x))&&new Set(v.attachmentIds).size===v.attachmentIds.length)return v;
 throw new SyntaxError();
}
export async function handleHoEditorialRequest(req:Request,env:HoEditorialEnv):Promise<Response>{
 const u=new URL(req.url);
 if(env.APP_ENV!=="staging"||u.protocol!=="https:"||normalizeHostname(u.hostname)!==HO_STAGING_HOSTNAME||normalizeHostname(req.headers.get("host")??"")!==HO_STAGING_HOSTNAME)return fail(404,"NOT_FOUND");
 const r=route(u.pathname);if(!r)return fail(404,"NOT_FOUND");
 const writing=r.kind==="decision";
 if(req.method!==(writing?"POST":"GET"))return fail(405,"METHOD_NOT_ALLOWED");
 if(!validQuery(u,r.kind))return fail(400,"INVALID_INPUT");
 if(writing&&req.headers.get("origin")!==u.origin)return fail(403,"INVALID_ORIGIN");
 if(!writing&&(req.body||req.headers.has("idempotency-key")))return fail(400,"INVALID_INPUT");
 try{
  const actor=await authorizeHoShell(req.headers,env);
  if(!actor.permissionKeys.includes("piner.post.ho_view")||writing&&!actor.permissionKeys.includes("piner.post.ho_manage"))return fail(403,"ACCESS_PERMISSION_DENIED");
  const credential=await teamCredentialFromHeaders(req.headers,env,"BO");
  if(credential.kind!=="password")return fail(401,"AUTH_REQUIRED");
  if(!env.PINO_HO_EDITORIAL_CORE||typeof env.PINO_HO_EDITORIAL_CORE.executeWithStaffPassword!=="function")return fail(503,"HO_EDITORIAL_UNAVAILABLE");
  let body:unknown,idempotencyKey:string|undefined;
  if(writing){
   idempotencyKey=req.headers.get("idempotency-key")??"";if(!key.test(idempotencyKey))return fail(400,"INVALID_IDEMPOTENCY");
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")??""))return fail(415,"UNSUPPORTED_MEDIA_TYPE");
   try{body=await payload(req);}catch(e){return e instanceof RangeError?fail(413,"PAYLOAD_TOO_LARGE"):fail(400,"INVALID_BODY");}
  }
  const result=await env.PINO_HO_EDITORIAL_CORE.executeWithStaffPassword({method:req.method,path:core+r.suffix+u.search,...(writing?{body,idempotencyKey}:{})},credential.token);
  if(result.status!==200){
   const status=[400,401,403,404,405,409,429,503].includes(result.status)?result.status:503;
   return fail(status,status===409?"EDITORIAL_CONFLICT":status===401?"AUTH_REQUIRED":status===403?"ACCESS_PERMISSION_DENIED":status===404?"NOT_FOUND":status===400?"INVALID_INPUT":"HO_EDITORIAL_UNAVAILABLE");
  }
  return json(200,result.body,result.requestId);
 }catch(e){if(e instanceof BoShellGateError)return fail(e.status,"HO_ACCESS_DENIED");return fail(503,"HO_EDITORIAL_UNAVAILABLE");}
}
