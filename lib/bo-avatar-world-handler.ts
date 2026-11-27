/** PAP-2153 / PNR-WORLD: BO facade; Core owns authentication, authorization and domain writes. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
export interface BoAvatarWorldEnv extends TeamAccessEnv{PINO_BO_CORE:BoAccessCoreBinding}
const V7="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PATH=new RegExp("^pinoria/avatars/("+V7+")/world(/commands)?$");
const ID=new RegExp("^"+V7+"$");
export const isBoAvatarWorldPath=(path:string)=>PATH.test(path);
class InvalidInput extends Error{}
function invalid():never{throw new InvalidInput("Invalid Avatar World request")}
function id(v:unknown):string{if(typeof v!=="string"||!ID.test(v))invalid();return v}
function json(body:unknown,status:number,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}})}
async function command(request:Request){
 if((request.headers.get("content-type")??"").split(";")[0].trim().toLowerCase()!=="application/json")invalid();
 let raw:unknown;try{raw=await request.json()}catch{invalid()}
 if(!raw||typeof raw!=="object"||Array.isArray(raw))invalid();
 const b=raw as Record<string,unknown>;
 if(!Number.isSafeInteger(b.expectedVersion)||Number(b.expectedVersion)<1||Number(b.expectedVersion)>=Number.MAX_SAFE_INTEGER-1)invalid();
 const expectedVersion=Number(b.expectedVersion),kind=b.kind;
 const exact=(keys:string[])=>{if(Object.keys(b).sort().join(",")!==keys.sort().join(","))invalid()};
 switch(kind){
 case "grant":exact(["kind","expectedVersion","worldId","label"]);if(typeof b.label!=="string"||!b.label.trim()||b.label.trim().length>180)invalid();return {kind,expectedVersion,worldId:id(b.worldId),label:b.label.trim()};
 case "live":exact(["kind","expectedVersion","instanceId"]);return {kind,expectedVersion,instanceId:id(b.instanceId)};
 case "scene":exact(["kind","expectedVersion","instanceId","sceneId","accessible"]);if(typeof b.accessible!=="boolean")invalid();return {kind,expectedVersion,instanceId:id(b.instanceId),sceneId:id(b.sceneId),accessible:b.accessible};
 case "layer":exact(["kind","expectedVersion","instanceId","layerId","unlocked"]);if(typeof b.unlocked!=="boolean")invalid();return {kind,expectedVersion,instanceId:id(b.instanceId),layerId:id(b.layerId),unlocked:b.unlocked};
 default:invalid();
 }
}
export async function handleBoAvatarWorldRequest(request:Request,env:BoAvatarWorldEnv,path:string,keyResolver?:Parameters<typeof teamCredential>[3]):Promise<Response>{
 try{
  const match=PATH.exec(path);
  if(!match)return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
  const post=!!match[2];
  if(request.method!==(post?"POST":"GET"))return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
  const qs=[...new URL(request.url).searchParams.entries()];
  if(qs.length!==1||qs[0]?.[0]!=="centerId")invalid();
  const centerId=id(qs[0][1]);
  const key=post?request.headers.get("idempotency-key"):null;
  if(post&&(!key||key.trim()!==key||key.length<8||key.length>200||/[\u0000-\u001f\u007f]/.test(key)))invalid();
  const body=post?await command(request):undefined;
  const credential=await teamCredential(request,env,"BO",keyResolver);
  const input:BoAccessRequest={method:request.method,path,resource:{centerId},...(body?{body}:{}),...(key?{idempotencyKey:key}:{})};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,input,credential);
  return json(result.body,result.status,result.requestId);
 }catch(error){
  if(error instanceof TeamAuthError)return json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
  if(error instanceof InvalidInput)return json({error:{code:"PLATFORM_INVALID_INPUT",message:error.message}},400);
  return json({error:{code:"PLATFORM_INTERNAL_ERROR"}},500);
 }
}
