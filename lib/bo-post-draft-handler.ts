/** PAP-2228 / PNR-APP-HUB candidate private Post BFF; staging-only and Core-authorized. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
export interface BoPostDraftEnv extends TeamAccessEnv{PINO_BO_CORE:BoAccessCoreBinding;APP_ENV?:string;}
const base="learning/piner-posts",peoplePath=base+"/people",uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",id=new RegExp("^"+uuid+"$"),detail=new RegExp("^"+base+"/"+uuid+"$");
class BadInput extends Error{}
function requireId(v:unknown):string{if(typeof v!=="string"||!id.test(v))throw new BadInput();return v;}
function json(body:unknown,status:number,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...(requestId?{"x-request-id":requestId}:{})}});}
function failure(status:number,code:string){return json({error:{code}},status);}
async function readBody(request:Request){
 if(!(request.headers.get("content-type")??"").toLowerCase().match(/^application\/json(?:\s*;|$)/))throw new BadInput();
 const reader=request.body?.getReader();if(!reader)throw new BadInput();
 const decoder=new TextDecoder("utf-8",{fatal:true});let length=0,raw="";
 try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>16384){await reader.cancel();throw new BadInput();}raw+=decoder.decode(next.value,{stream:true});}raw+=decoder.decode();const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw new BadInput();return value as Record<string,unknown>;}catch{throw new BadInput();}finally{reader.releaseLock();}
}
export async function handleBoPostDraftRequest(request:Request,env:BoPostDraftEnv,path:string):Promise<Response>{
 try{
  const url=new URL(request.url),isDetail=detail.test(path),isPeople=path===peoplePath,method=request.method;
  if(env.APP_ENV!=="staging"||url.origin!=="https://"+BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||(!isDetail&&path!==base&&!isPeople))return failure(404,"PLATFORM_NOT_FOUND");
  if(isPeople?method!=="GET":method!=="GET"&&!(method==="POST"&&!isDetail&&path===base)&&!(method==="PATCH"&&isDetail))return failure(405,"PLATFORM_METHOD_NOT_ALLOWED");
  const allowed=method==="GET"&&path===base?["centerId","limit","beforeId"]:method==="GET"&&isPeople?["centerId","programKey","q","after","limit"]:["centerId"];
  for(const k of url.searchParams.keys())if(!allowed.includes(k)||url.searchParams.getAll(k).length!==1)throw new BadInput();
  const centerId=requireId(url.searchParams.get("centerId")),query=new URLSearchParams({centerId});
  const limit=url.searchParams.get("limit"),before=url.searchParams.get("beforeId");
  if(limit!==null){if(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100)throw new BadInput();query.set("limit",limit);}
  if(before!==null)query.set("beforeId",requireId(before));
  if(isPeople){
   const programKey=url.searchParams.get("programKey"),q=url.searchParams.get("q"),after=url.searchParams.get("after");
   if(programKey!=="AFTERSCHOOL"&&programKey!=="MYTIME")throw new BadInput();
   if(q!==null&&(q.length>120||[...q].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))throw new BadInput();
   if(after!==null)query.set("after",requireId(after));
   query.set("programKey",programKey);if(q!==null)query.set("q",q);
  }
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind==="support"||request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return failure(403,"ACCESS_PERMISSION_DENIED");
  const core:BoAccessRequest={method,path:path+"?"+query.toString(),resource:{centerId}};
  if(method!=="GET"){
   if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return failure(403,"ACCESS_PERMISSION_DENIED");
   const key=request.headers.get("idempotency-key");if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BadInput();
   const input=await readBody(request),caption=input.caption;
   if(caption!==undefined&&(typeof caption!=="string"||caption.trim().length>2000))throw new BadInput();
   if(method==="POST"){
    if(Object.keys(input).some(k=>!["personId","programKey","studentId","caption"].includes(k)))throw new BadInput();
    const personId=input.personId===undefined?undefined:requireId(input.personId),studentId=input.studentId===undefined?undefined:requireId(input.studentId),programKey=input.programKey;
    if(!personId&&!studentId)throw new BadInput();
    if(programKey!==undefined&&programKey!=="AFTERSCHOOL"&&programKey!=="MYTIME")throw new BadInput();
    if(programKey==="MYTIME"&&(!personId||studentId!==undefined))throw new BadInput();
    core.body={...(personId?{personId}:{}),...(studentId?{studentId}:{}),...(programKey?{programKey}:{}),...(caption===undefined?{}:{caption})};
   }else{
    if(Object.keys(input).some(k=>!["caption","expectedVersion"].includes(k))||typeof caption!=="string"||typeof input.expectedVersion!=="number"||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)throw new BadInput();
    core.body={caption,expectedVersion:input.expectedVersion};
   }
   core.idempotencyKey=key;
  }
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
  return json(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return failure(e.status,"IDENTITY_AUTHENTICATION_FAILED");if(e instanceof BadInput)return failure(400,"PLATFORM_INVALID_INPUT");return failure(500,"PLATFORM_INTERNAL_ERROR");}
}
