/** PLT-DELIVERY / PAP-1037 / PAP-1043 / PAP-2225 — exact Staging command facade. Not mounted until host/write admission. */
import type {BoWriteEnv} from "./bo-write-handler";
import {callBoAccessCoreWithCredential,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError} from "./team-auth";
import {BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";

const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const canonical=new RegExp("^"+uuid+"$");
const createPath="delivery/running-classes/create-inactive";
const inlinePath=new RegExp("^delivery/running-classes/("+uuid+")/inline$");
const editable=["operationalName","weekdayIso","windowStartsLocal","windowEndsLocal","optimalConcurrentCapacity","hardConcurrentCapacity","defaultParticipationMinutes","status","pathProgramId","learningSpaceId"];
const json=(body:unknown,status:number,requestId?:string)=>Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
const deny=(status:number,code:string,message:string)=>json({error:{code,message}},status);
const invalid=()=>deny(400,"PLATFORM_INVALID_INPUT","Invalid Running Class command.");
function obj(value:unknown):Record<string,unknown>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}
export function runningClassCommandMethod(path:string):"POST"|"PATCH"|null{return path===createPath?"POST":inlinePath.test(path)?"PATCH":null;}
export async function handleRunningClassCommand(request:Request,env:BoWriteEnv,path:string):Promise<Response>{
 const method=runningClassCommandMethod(path),url=new URL(request.url);
 if(!method||env.APP_ENV!=="staging"||url.protocol!=="https:"||url.host!==BO_STAGING_HOSTNAME||normalizeHostname(request.headers.get("host")??url.hostname)!==BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||url.hash||url.username||url.password)
  return deny(404,"PLATFORM_NOT_FOUND","Not found.");
 if(request.method!==method)return deny(405,"PLATFORM_METHOD_NOT_ALLOWED","Method not allowed.");
 if(request.headers.get("origin")!=="https://"+BO_STAGING_HOSTNAME||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")
  return deny(403,"PLATFORM_FORBIDDEN","Same-origin JSON required.");
 const ids=url.searchParams.getAll("centerId"),centerId=ids[0];
 const expectedActor=request.headers.get("x-pino-expected-principal");
 if(url.searchParams.size!==1||ids.length!==1||!canonical.test(centerId??"")||!canonical.test(expectedActor??""))return invalid();
 const key=request.headers.get("idempotency-key");
 if(method==="POST"?(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key)):key!==null)return invalid();
 let body:Record<string,unknown>|null;
 try{const raw=await request.text();if(raw.length>4096)return invalid();body=obj(JSON.parse(raw));}catch{return invalid();}
 if(!body)return invalid();
 const allowed=method==="POST"?[...editable,"centerId","deliveryTopology"]:[...editable,"expectedVersion"];
 if(Object.keys(body).some(k=>!allowed.includes(k)))return invalid();
 if(method==="POST"){
  if(Object.keys(body).length!==allowed.length||body.centerId!==centerId||body.status!=="INACTIVE")return invalid();
 }else if(Object.keys(body).length<2||!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)return invalid();
 for(const field of ["pathProgramId","learningSpaceId"])if(Object.hasOwn(body,field)&&(typeof body[field]!=="string"||!canonical.test(body[field])))return invalid();
 try{
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return deny(403,"PLATFORM_FORBIDDEN","Authenticated session required.");
  const context=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"GET",path:"context",resource:{centerId}},credential);
  if(context.status!==200)return json(context.body,context.status,context.requestId);
  const data=obj(obj(context.body)?.data);
  if(!data||data.userId!==expectedActor||data.surface!=="BO"||data.entitled!==true||!Array.isArray(data.permissionKeys)||!data.permissionKeys.includes("delivery.schedule.manage"))
   return deny(403,"ACCESS_PERMISSION_DENIED","Running Class session or permission changed.");
  const core:BoAccessRequest={method,path,body,resource:{centerId,...(method==="PATCH"?{runningClassId:inlinePath.exec(path)![1]}:{})},...(key?{idempotencyKey:key}:{})};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
  return json(result.body,result.status,result.requestId);
 }catch(error){
  if(error instanceof TeamAuthError)return deny(error.status,"IDENTITY_AUTHENTICATION_FAILED",error.message);
  return deny(500,"PLATFORM_INTERNAL_ERROR","An unexpected error occurred.");
 }
}
