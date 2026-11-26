/** PAP-2288: private BO household facade. Core owns scope and all domain commands. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
export interface LeadHouseholdEnv extends TeamAccessEnv {APP_ENV?:string;PINO_BO_CORE:BoAccessCoreBinding}
import {leadHouseholdRoute} from "./bo-lead-household-route";
import {parseLeadRecoveryInput,parseLeadRecoveryReceipt,type LeadRecoveryInput} from "./bo-lead-recovery-api";
const root="/api/bo/";
const versionFields=["expectedVersion"];
class BadInput extends Error{}
function json(status:number,body:unknown,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",...(requestId?{"x-request-id":requestId}:{})}});}
function fail(status:number,code:string,requestId?:string){return json(status,{error:{code}},requestId);}
async function readJson(request:Request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))throw new BadInput();
 const reader=request.body?.getReader();if(!reader)throw new BadInput();
 const decoder=new TextDecoder("utf-8",{fatal:true});let size=0,raw="";
 try{while(true){const n=await reader.read();if(n.done)break;size+=n.value.byteLength;if(size>32768){await reader.cancel();throw new BadInput();}raw+=decoder.decode(n.value,{stream:true});}raw+=decoder.decode();
 const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw new BadInput();return value as Record<string,unknown>;
 }catch{throw new BadInput();}finally{reader.releaseLock();}
}
export async function handleLeadHousehold(request:Request,env:LeadHouseholdEnv):Promise<Response>{
 try{
 const url=new URL(request.url);
 if(env.APP_ENV!=="staging"||url.origin!=="https://"+BO_STAGING_HOSTNAME||normalizeHostname(request.headers.get("host")??"")!==BO_STAGING_HOSTNAME||!url.pathname.startsWith(root)||url.hash||url.username||url.password)return fail(404,"PLATFORM_NOT_FOUND");
 const path=url.pathname.slice(root.length),method=request.method;
 const route=leadHouseholdRoute(path);
 if(!route)return fail(404,"PLATFORM_NOT_FOUND");
 if(method!==route.method)return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
 const {search,recovery,create,hist,a,c}=route;
 for(const k of url.searchParams.keys())if(!hist||!["limit","cursor"].includes(k)||url.searchParams.getAll(k).length!==1)throw new BadInput();
 if(request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return fail(403,"ACCESS_PERMISSION_DENIED");
 const core:BoAccessRequest={method,path};
 let recoveryInput:LeadRecoveryInput|null=null;
 if(hist){
 const limit=url.searchParams.get("limit"),cursor=url.searchParams.get("cursor");
 if(limit!==null&&(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100)||cursor!==null&&(!cursor||cursor.length>4096))throw new BadInput();
 core.body={...(limit===null?{}:{limit:Number(limit)}),...(cursor===null?{}:{cursor})};
 }
 if(method==="POST"){
 if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return fail(403,"ACCESS_PERMISSION_DENIED");
 const input=await readJson(request);
 const field=a?.[1],childKind=c?.[1],childAction=c?.[2];
 const allowed=recovery?["kind","key","target","expectedVersion"]:search?["q","status","program","path","sort","limit","cursor"]:create?["contact","members","primaryMemberIndex"]:field==="contact"?[...versionFields,"contact"]:field==="members"?[...versionFields,"member"]:field==="primary"?[...versionFields,"memberId"]:field==="relationships"?[...versionFields,"relationship"]:field==="archive"?[...versionFields,"reason"]:childAction==="update"?[...versionFields,childKind==="members"?"member":"relationship"]:versionFields;
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw new BadInput();
 if(recovery){recoveryInput=parseLeadRecoveryInput(input);if(!recoveryInput)throw new BadInput();}
 if(!search&&!recovery){
 const key=request.headers.get("idempotency-key");if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BadInput();
 core.idempotencyKey=key;
 if(!create&&(typeof input.expectedVersion!=="number"||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1))throw new BadInput();
 }
 core.body=input;
 }
 const credential=await teamCredential(request,env,"BO");
 if(credential.kind!=="password")return fail(403,"ACCESS_PERMISSION_DENIED");
 const expectedActor=request.headers.get("x-pino-expected-actor");
 if(!expectedActor||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedActor))return fail(400,"LEAD_ACTOR_REQUIRED");
 const context=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"GET",path:"context"},credential);
 if(context.status===401||context.status===403)return fail(context.status,"ACCESS_PERMISSION_DENIED",context.requestId);
 if(context.status!==200)return fail(503,"PLATFORM_UNAVAILABLE",context.requestId);
 const actor=(context.body as {data?:{userId?:unknown;surface?:unknown;entitled?:unknown}}|null)?.data;
 if(!actor||actor.userId!==expectedActor||actor.surface!=="BO"||actor.entitled!==true)return fail(403,"LEAD_ACTOR_CHANGED",context.requestId);
 const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
 // Never forward upstream diagnostic message or raw user input in errors.
 if(result.status>=400){const code=(result.body as {error?:{code?:unknown}}|null)?.error?.code;return fail(result.status,typeof code==="string"&&/^[A-Z][A-Z0-9_]{0,100}$/.test(code)?code:"LEAD_REQUEST_FAILED",result.requestId);}
 if(recoveryInput){
  const body=result.body as {data?:unknown}|null;
  const receipt=parseLeadRecoveryReceipt(body?.data,recoveryInput);
  if(result.status!==200||!receipt)return fail(502,"LEAD_RECOVERY_RESPONSE_INVALID",result.requestId);
  return json(200,{data:receipt},result.requestId);
 }
 return json(result.status,result.body,result.requestId);
 }catch(e){if(e instanceof BadInput)return fail(400,"PLATFORM_INVALID_INPUT");if(e instanceof TeamAuthError)return fail(e.status,"ACCESS_PERMISSION_DENIED");return fail(503,"PLATFORM_UNAVAILABLE");}
}
