/** PAP-2134 / PAP-2172: exact staging-only Post attachments BFF. */
import {callBoAccessCoreWithCredential,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError} from "./team-auth";
import {verifyPostActor} from "./bo-post-actor-continuity";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
import type {BoPostDraftEnv} from "./bo-post-draft-handler";
const MAX=5*1024*1024,types=new Set(["image/jpeg","image/png","image/webp"]);
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const id=new RegExp("^"+uuid+"$"),route=new RegExp("^learning/piner-posts/"+uuid+"/attachments(?:/("+uuid+")/(confirm|preview|revoke))?$");
class Invalid extends Error{}
const invalid=():never=>{throw new Invalid();};
function integer(v:unknown):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1)invalid();return v as number;}
function version(v:string|null){if(!v||!/^\d{1,16}$/.test(v))invalid();return integer(Number(v));}
function json(body:unknown,status:number,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string)=>json({error:{code}},status);
async function bytes(request:Request,max:number):Promise<ArrayBuffer>{
 const length=request.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>max))invalid();
 const reader=request.body?.getReader();if(!reader)throw new Invalid();
 const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const n=await reader.read();if(n.done)break;total+=n.value.byteLength;if(total>max){await reader.cancel();invalid();}chunks.push(n.value);}if(total<1||(length!==null&&total!==Number(length)))invalid();
 const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result.buffer;
 }finally{reader.releaseLock();}
}
function preview(body:unknown,requestId:string):Response{
 const r=(body as {data?:{mimeType?:unknown;byteSize?:unknown;bytesBase64?:unknown}})?.data;
 if(!r||typeof r.mimeType!=="string"||!types.has(r.mimeType)||typeof r.byteSize!=="number"||!Number.isSafeInteger(r.byteSize)||r.byteSize<1||r.byteSize>MAX||typeof r.bytesBase64!=="string"||r.bytesBase64.length!==4*Math.ceil(r.byteSize/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(r.bytesBase64))return fail(502,"PLATFORM_INTERNAL_ERROR");
 try{const decoded=atob(r.bytesBase64);if(decoded.length!==r.byteSize||btoa(decoded)!==r.bytesBase64)return fail(502,"PLATFORM_INTERNAL_ERROR");return new Response(Uint8Array.from(decoded,c=>c.charCodeAt(0)),{status:200,headers:{"content-type":r.mimeType,"content-length":String(r.byteSize),"content-disposition":"inline","cache-control":"private, no-store, no-transform","x-content-type-options":"nosniff","x-request-id":requestId}});}catch{return fail(502,"PLATFORM_INTERNAL_ERROR");}
}
export async function handleBoPostMediaRequest(request:Request,env:BoPostDraftEnv,path:string):Promise<Response>{
 try{
 const url=new URL(request.url),match=route.exec(path),method=request.method;
 if(env.APP_ENV!=="staging"||url.origin!=="https://"+BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||!match)return fail(404,"PLATFORM_NOT_FOUND");
 const operation=match[2];
 if(!(method==="GET"&&(!operation||operation==="preview"))&&!(method==="POST"&&operation!=="preview"))return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
 if([...url.searchParams.keys()].some(k=>k!=="centerId")||url.searchParams.getAll("centerId").length!==1)invalid();
 const centerId=url.searchParams.get("centerId");if(!centerId||!id.test(centerId))throw new Invalid();
 const credential=await teamCredential(request,env,"BO");
 if(credential.kind==="support"||request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return fail(403,"ACCESS_PERMISSION_DENIED");
 const core:BoAccessRequest={method,path:path+"?centerId="+centerId,resource:{centerId}};
 if(method==="POST"){
  if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return fail(403,"ACCESS_PERMISSION_DENIED");
  const key=request.headers.get("idempotency-key");if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new Invalid();core.idempotencyKey=key;
  const mime=request.headers.get("content-type");
  if(operation==="revoke"){
   if(!mime||!/^application\/json(?:\s*;|$)/i.test(mime)||request.headers.has("x-pino-post-version")||request.headers.has("x-pino-attachment-version"))invalid();
   let payload:unknown;try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(await bytes(request,1024)));}catch{invalid();}
   if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Invalid();const body=payload as Record<string,unknown>;
   if(Object.keys(body).some(k=>!["expectedPostVersion","expectedAttachmentVersion"].includes(k)))invalid();
   core.body={expectedPostVersion:integer(body.expectedPostVersion),expectedAttachmentVersion:integer(body.expectedAttachmentVersion)};
  }else{
   if(!mime||!types.has(mime))invalid();
   const expectedPostVersion=version(request.headers.get("x-pino-post-version")),attachment=request.headers.get("x-pino-attachment-version");
   if(!operation&&attachment!==null)invalid();
   core.body={expectedPostVersion,mimeType:mime,...(operation==="confirm"?{expectedAttachmentVersion:version(attachment)}:{}),bytes:await bytes(request,MAX)};
  }
 }
 const admission=await verifyPostActor(request,env.PINO_BO_CORE,credential,centerId,method==="GET"?"piner.post.view":"piner.post.edit");
 if(admission!==200)return fail(admission,admission===400?"PLATFORM_INVALID_INPUT":"ACCESS_PERMISSION_DENIED");
 const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
 if(operation==="preview"&&result.status===200)return preview(result.body,result.requestId);
 return json(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return fail(e.status,"IDENTITY_AUTHENTICATION_FAILED");if(e instanceof Invalid)return fail(400,"PLATFORM_INVALID_INPUT");return fail(500,"PLATFORM_INTERNAL_ERROR");}
}
