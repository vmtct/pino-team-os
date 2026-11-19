// PAP-2164 / PAP-2158: narrow private Workshop BFF, staging only; Core owns all access and domain writes.
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding,type FounderRequest} from "./founder-core";
import {callBoAccessCoreWithCredential,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError} from "./team-auth";
import {HO_STAGING_HOSTNAME,BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
export interface WorkshopEnv extends HoEnv {PINO_CORE?:PinoCoreBinding}
const base="learning/mytime-workshops";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const id=new RegExp("^"+uuid+"$");
const record=new RegExp("^"+base+"/("+uuid+")(/history|/cancel)?$");
const lookup=new RegExp("^"+base+"/lookup/(centers|missions|specialties|staff)$");
const fields=["name","centerId","startAt","endAt","missionIds","specialtyId","capacity","note","eventLeadStaffId","academicLeadStaffId","otherStaffIds","facebookUrl"];
class BadInput extends Error{}
function json(status:number,body:unknown){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});}
function fail(status:number,code:string){return json(status,{error:{code}});}
function uid(value:unknown):string{if(typeof value!=="string"||!id.test(value))throw new BadInput();return value;}
async function readJson(request:Request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))throw new BadInput();
 const reader=request.body?.getReader();if(!reader)throw new BadInput();
 const decoder=new TextDecoder("utf-8",{fatal:true});let len=0,raw="";
 try{while(true){const n=await reader.read();if(n.done)break;len+=n.value.byteLength;if(len>32768){await reader.cancel();throw new BadInput();}raw+=decoder.decode(n.value,{stream:true});}raw+=decoder.decode();
  const v:unknown=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw new BadInput();return v as Record<string,unknown>;
 }catch{throw new BadInput();}finally{reader.releaseLock();}
}
const isWrite=(method:string)=>method==="POST"||method==="PATCH";
export async function handleMyTimeWorkshop(request:Request,env:WorkshopEnv,surface:"HO"|"BO"):Promise<Response>{
 try{
  const url=new URL(request.url),host=surface==="HO"?HO_STAGING_HOSTNAME:BO_STAGING_HOSTNAME,root="/api/"+surface.toLowerCase()+"/";
  if(env.APP_ENV!=="staging"||url.origin!=="https://"+host||normalizeHostname(request.headers.get("host")??"")!==host||!url.pathname.startsWith(root)||url.hash||url.username||url.password)return fail(404,"PLATFORM_NOT_FOUND");
  const path=url.pathname.slice(root.length),m=record.exec(path),l=lookup.exec(path),list=path===base,method=request.method;
  if(!list&&!m&&!l)return fail(404,"PLATFORM_NOT_FOUND");
  const history=m?.[2]==="/history",cancel=m?.[2]==="/cancel";
  if(surface==="BO"&&(method!=="GET"||l||cancel))return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
  if(surface==="HO"&&!(method==="GET"&&!cancel||method==="POST"&&(list||cancel)||method==="PATCH"&&m&&!m[2]))return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
  const allowed=surface==="BO"?["centerId",...(list||history?["limit","beforeId"]:[])]:l?["limit","offset","search"]:method==="GET"&&(list||history)?["limit","beforeId"]:[];
  for(const k of url.searchParams.keys())if(!allowed.includes(k)||url.searchParams.getAll(k).length!==1)throw new BadInput();
  const limit=url.searchParams.get("limit"),before=url.searchParams.get("beforeId"),offset=url.searchParams.get("offset"),search=url.searchParams.get("search");
  if(limit!==null&&(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100))throw new BadInput();
  if(before!==null)uid(before);
  if(offset!==null&&!/^\d{1,6}$/.test(offset))throw new BadInput();
  if(search!==null&&search.length>100)throw new BadInput();
  const center=surface==="BO"?uid(url.searchParams.get("centerId")):null;
  if(request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return fail(403,"ACCESS_PERMISSION_DENIED");
  const core:FounderRequest={method,path:path+(url.searchParams.size?"?"+url.searchParams.toString():"")};
  if(isWrite(method)){
   if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return fail(403,"ACCESS_PERMISSION_DENIED");
   const key=request.headers.get("idempotency-key");if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BadInput();
   const input=await readJson(request),allowedFields=cancel?["expectedVersion"]:method==="PATCH"?[...fields,"expectedVersion"]:fields;
   if(Object.keys(input).some(k=>!allowedFields.includes(k)))throw new BadInput();
   if((cancel||method==="PATCH")&&(typeof input.expectedVersion!=="number"||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1))throw new BadInput();
   core.body=input;core.idempotencyKey=key;
  }
  if(surface==="HO"){
   const actor=await authorizeHoShell(request.headers,env);
   if(!actor.userId||!actor.permissionKeys.includes("learning.mytime_workshop.ho_view")||(isWrite(method)&&!actor.permissionKeys.includes("learning.mytime_workshop.ho_manage")))return fail(403,"ACCESS_PERMISSION_DENIED");
   const credential=await teamCredential(request,env,"BO");if(credential.kind!=="password")return fail(401,"IDENTITY_UNAUTHORIZED");
   if(!env.PINO_CORE?.executeWithStaffPassword)return fail(503,"PLATFORM_UNAVAILABLE");
   const result=await callFounderCoreWithStaffPassword(env.PINO_CORE,core,credential.token);return json(result.status,result.body);
  }
  const credential=await teamCredential(request,env,"BO");if(credential.kind==="support")return fail(403,"ACCESS_PERMISSION_DENIED");
  const req:BoAccessRequest={method,path:core.path,resource:{centerId:center!}};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,req,credential);return json(result.status,result.body);
 }catch(e){if(e instanceof BadInput)return fail(400,"PLATFORM_INVALID_INPUT");if(e instanceof BoShellGateError||e instanceof TeamAuthError)return fail(e.status,"ACCESS_PERMISSION_DENIED");return fail(503,"PLATFORM_UNAVAILABLE");}
}
