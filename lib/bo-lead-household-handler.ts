/** PAP-2288: private BO household facade. Core owns scope and all domain commands. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
export interface LeadHouseholdEnv extends TeamAccessEnv {APP_ENV?:string;PINO_BO_CORE:BoAccessCoreBinding}
const base="acquisition/households";
const root="/api/bo/";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const record=new RegExp("^"+base+"/"+uuid+"$");
const history=new RegExp("^"+base+"/"+uuid+"/history$");
const action=new RegExp("^"+base+"/"+uuid+"/(contact|members|primary|relationships|archive)$");
const child=new RegExp("^"+base+"/"+uuid+"/(members|relationships)/"+uuid+"/(update|retire|confirm)$");
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
 const search=path===base+"/search",create=path===base,detail=record.test(path),hist=history.test(path),a=action.exec(path),c=child.exec(path);
 if(!search&&!create&&!detail&&!hist&&!a&&!c||c?.[1]==="members"&&c[2]==="confirm")return fail(404,"PLATFORM_NOT_FOUND");
 if(method!==(detail||hist?"GET":"POST"))return fail(405,"PLATFORM_METHOD_NOT_ALLOWED");
 for(const k of url.searchParams.keys())if(!hist||!["limit","cursor"].includes(k)||url.searchParams.getAll(k).length!==1)throw new BadInput();
 if(request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return fail(403,"ACCESS_PERMISSION_DENIED");
 const core:BoAccessRequest={method,path};
 if(hist){
 const limit=url.searchParams.get("limit"),cursor=url.searchParams.get("cursor");
 if(limit!==null&&(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100)||cursor!==null&&(!cursor||cursor.length>4096))throw new BadInput();
 core.body={...(limit===null?{}:{limit:Number(limit)}),...(cursor===null?{}:{cursor})};
 }
 if(method==="POST"){
 if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return fail(403,"ACCESS_PERMISSION_DENIED");
 const input=await readJson(request);
 const field=a?.[1],childKind=c?.[1],childAction=c?.[2];
 const allowed=search?["q","status","program","path","sort","limit","cursor"]:create?["contact","members","primaryMemberIndex"]:field==="contact"?[...versionFields,"contact"]:field==="members"?[...versionFields,"member"]:field==="primary"?[...versionFields,"memberId"]:field==="relationships"?[...versionFields,"relationship"]:field==="archive"?[...versionFields,"reason"]:childAction==="update"?[...versionFields,childKind==="members"?"member":"relationship"]:versionFields;
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw new BadInput();
 if(!search){
 const key=request.headers.get("idempotency-key");if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BadInput();
 core.idempotencyKey=key;
 if(!create&&(typeof input.expectedVersion!=="number"||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1))throw new BadInput();
 }
 core.body=input;
 }
 const credential=await teamCredential(request,env,"BO");
 if(credential.kind!=="password")return fail(403,"ACCESS_PERMISSION_DENIED");
 const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
 // Never forward upstream diagnostic message or raw user input in errors.
 if(result.status>=400){const code=(result.body as {error?:{code?:unknown}}|null)?.error?.code;return fail(result.status,typeof code==="string"&&/^[A-Z][A-Z0-9_]{0,100}$/.test(code)?code:"LEAD_REQUEST_FAILED",result.requestId);}
 return json(result.status,result.body,result.requestId);
 }catch(e){if(e instanceof BadInput)return fail(400,"PLATFORM_INVALID_INPUT");if(e instanceof TeamAuthError)return fail(e.status,"ACCESS_PERMISSION_DENIED");return fail(503,"PLATFORM_UNAVAILABLE");}
}
