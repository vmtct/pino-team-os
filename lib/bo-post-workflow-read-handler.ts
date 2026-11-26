/** PAP-2386 / PNR-APP-HUB. Unmounted exact Core Diary read BFF. */
import {callBoAccessCoreWithCredential} from "./bo-core";
import {teamCredential,TeamAuthError} from "./team-auth";
import type {BoPostDraftEnv} from "./bo-post-draft-handler";
import {verifyPostActor} from "./bo-post-actor-continuity";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const id=new RegExp("^"+uuid+"$"),route=new RegExp("^learning/piner-posts/"+uuid+"/(submission-state|workflow-state|diaries(?:/"+uuid+"/photos(?:/"+uuid+")?)?)$");
export function matchPostWorkflowRead(path:string){return route.exec(path)?.[1]??null;}
function json(body:unknown,status:number,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string)=>json({error:{code}},status);
export async function handleBoPostWorkflowRead(request:Request,env:BoPostDraftEnv,path:string){
 try{
  const url=new URL(request.url),operation=matchPostWorkflowRead(path);
  if(env.APP_ENV!=="staging"||url.origin!=="https://"+BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||!operation)return fail(404,"PLATFORM_NOT_FOUND");
  if(request.method!=="GET")return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
  if((request.headers.has("origin")&&request.headers.get("origin")!==url.origin)||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return fail(403,"ACCESS_PERMISSION_DENIED");
  const allowed=operation==="diaries"?["centerId","after","limit"]:["centerId"];
  const centerId=url.searchParams.get("centerId"),after=url.searchParams.get("after"),limit=url.searchParams.get("limit");
  if(!centerId||!id.test(centerId)||[...url.searchParams.keys()].some(k=>!allowed.includes(k)||url.searchParams.getAll(k).length!==1)||request.body!==null||request.headers.has("idempotency-key")||(after!==null&&!id.test(after))||(limit!==null&&!/^(?:[1-9]|10)$/.test(limit)))return fail(400,"PLATFORM_INVALID_INPUT");
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind==="support"||request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return fail(403,"ACCESS_PERMISSION_DENIED");
  const query=new URLSearchParams({centerId});
  if(after!==null)query.set("after",after);
  if(limit!==null)query.set("limit",limit);
  const admission=await verifyPostActor(request,env.PINO_BO_CORE,credential,centerId,operation==="submission-state"?"piner.post.submit":"piner.post.diary.compose");
  if(admission!==200)return fail(admission,admission===400?"PLATFORM_INVALID_INPUT":"ACCESS_PERMISSION_DENIED");
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"GET",path:path+"?"+query.toString(),resource:{centerId}},credential);
  return json(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return fail(e.status,"IDENTITY_AUTHENTICATION_FAILED");return fail(500,"PLATFORM_INTERNAL_ERROR");}
}
