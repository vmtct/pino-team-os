/** PAP-2386 / PNR-APP-HUB. Feature-owned, unmounted BO workflow BFF. */
import {callBoAccessCoreWithCredential} from "./bo-core";
import {teamCredential,TeamAuthError} from "./team-auth";
import type {BoPostDraftEnv} from "./bo-post-draft-handler";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const id=new RegExp("^"+uuid+"$"),route=new RegExp("^learning/piner-posts/"+uuid+"/(?:(submit|diary-selection)|attachments/"+uuid+"/(diary-provenance))$");
class Invalid extends Error{}
function canonical(v:unknown):string{if(typeof v!=="string"||!id.test(v))throw new Invalid();return v;}
function version(v:unknown):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1||v>=Number.MAX_SAFE_INTEGER)throw new Invalid();return v;}
function list(v:unknown,max:number,min=0){if(!Array.isArray(v)||v.length<min||v.length>max)throw new Invalid();const values=v.map(canonical);if(new Set(values).size!==values.length)throw new Invalid();return values;}
function json(body:unknown,status:number,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string)=>json({error:{code}},status);
async function readBody(request:Request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))throw new Invalid();
 const reader=request.body?.getReader();if(!reader)throw new Invalid();
 let size=0,raw="";const decoder=new TextDecoder("utf-8",{fatal:true});
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>8192){await reader.cancel();throw new Invalid();}raw+=decoder.decode(r.value,{stream:true});}raw+=decoder.decode();const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw new Invalid();return v as Record<string,unknown>;}catch{throw new Invalid();}finally{reader.releaseLock();}
}
export function matchPostWorkflow(path:string){const m=route.exec(path);return m?(m[1]??m[2]) as "submit"|"diary-selection"|"diary-provenance":null;}
export async function handleBoPostWorkflowRequest(request:Request,env:BoPostDraftEnv,path:string){
 try{
  const url=new URL(request.url),operation=matchPostWorkflow(path);
  if(env.APP_ENV!=="staging"||url.origin!=="https://"+BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||!operation)return fail(404,"PLATFORM_NOT_FOUND");
  if(request.method!=="POST")return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
  if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return fail(403,"ACCESS_PERMISSION_DENIED");
  if([...url.searchParams.keys()].some(k=>k!=="centerId")||url.searchParams.getAll("centerId").length!==1)throw new Invalid();
  const centerId=canonical(url.searchParams.get("centerId")),key=request.headers.get("idempotency-key");
  if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new Invalid();
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind==="support"||request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return fail(403,"ACCESS_PERMISSION_DENIED");
  const input=await readBody(request),expectedVersion=version(input.expectedVersion);
  const allowed=operation==="submit"?["expectedVersion","attachmentIds"]:operation==="diary-selection"?["expectedVersion","diaryIds"]:["expectedVersion","expectedAttachmentVersion","diaryId","evidenceId","transform"];
  if(Object.keys(input).length!==allowed.length||Object.keys(input).some(k=>!allowed.includes(k)))throw new Invalid();
  let body:object;
  if(operation==="submit")body={expectedVersion,attachmentIds:list(input.attachmentIds,5,1)};
  else if(operation==="diary-selection")body={expectedVersion,diaryIds:list(input.diaryIds,20)};
  else{if(input.transform!=="RAW"&&input.transform!=="RETOUCHED")throw new Invalid();body={expectedVersion,expectedAttachmentVersion:version(input.expectedAttachmentVersion),diaryId:canonical(input.diaryId),evidenceId:canonical(input.evidenceId),transform:input.transform};}
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"POST",path:path+"?centerId="+centerId,resource:{centerId},body,idempotencyKey:key},credential);
  return json(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return fail(e.status,"IDENTITY_AUTHENTICATION_FAILED");if(e instanceof Invalid)return fail(400,"PLATFORM_INVALID_INPUT");return fail(500,"PLATFORM_INTERNAL_ERROR");}
}
