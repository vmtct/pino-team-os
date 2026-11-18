/** PAP-2097 / PAP-8 — private HO World facade. Scope staging read/create only. */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredentialFromHeaders} from "./team-auth";
import {BoShellGateError} from "./bo-shell-gate";
interface WorldRequest {method:string;path:string;body?:unknown;idempotencyKey?:string}
interface WorldResult {status:number;body:unknown;requestId:string}
export interface HoWorldEnv extends HoEnv {PINO_HO_WORLD_CORE?:{executeWithStaffPassword(request:WorldRequest,token:string):Promise<WorldResult>}}
const path="/api/ho/pinoria/worlds";
const MAX=4096;
function json(status:number,body:unknown,requestId?:string):Response{return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}})}
const fail=(status:number,code:string,message:string)=>json(status,{error:{code,message}});
async function readPayload(request:Request):Promise<unknown>{
 const length=Number(request.headers.get("content-length")??0);
 if(!Number.isFinite(length)||length<0||length>MAX)throw new RangeError("Payload too large");
 if(!request.body)throw new SyntaxError("JSON required");
 const reader=request.body.getReader();let bytes=0;const decoder=new TextDecoder("utf-8",{fatal:true});let text="";
 try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>MAX){await reader.cancel();throw new RangeError("Payload too large");}text+=decoder.decode(next.value,{stream:true})}text+=decoder.decode();}
 catch(e){if(e instanceof RangeError)throw e;throw new SyntaxError("Invalid JSON");}
 finally{reader.releaseLock();}
 const b:unknown=JSON.parse(text);
 if(!b||typeof b!=="object"||Array.isArray(b))throw new SyntaxError("JSON object required");
 if(Object.keys(b).some(k=>!["key","displayName","worldType","descriptionText"].includes(k)))throw new SyntaxError("Unsupported field");
 return b;
}
export async function handleHoWorldRequest(request:Request,env:HoWorldEnv):Promise<Response>{
 const u=new URL(request.url),method=request.method.toUpperCase();
 if(env.APP_ENV!=="staging"||normalizeHostname(u.hostname)!==HO_STAGING_HOSTNAME||normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||u.pathname!==path||u.search)return fail(404,"NOT_FOUND","Not found");
 if(method!=="GET"&&method!=="POST")return fail(405,"METHOD_NOT_ALLOWED","Method not allowed");
 try{
  const session=await authorizeHoShell(request.headers,env);
  const required=method==="GET"?"pinoria.world.view":"pinoria.world.manage";
  if(!session.permissionKeys.includes(required))return fail(403,"ACCESS_PERMISSION_DENIED","HO World permission required");
  const credential=await teamCredentialFromHeaders(request.headers,env,"BO");
  if(credential.kind!=="password")return fail(401,"AUTH_REQUIRED","Staff password session required");
  if(!env.PINO_HO_WORLD_CORE||typeof env.PINO_HO_WORLD_CORE.executeWithStaffPassword!=="function")return fail(503,"HO_WORLD_CORE_NOT_CONFIGURED","HO World unavailable");
  let body:unknown,idempotencyKey:string|undefined;
  if(method==="POST"){
   idempotencyKey=request.headers.get("idempotency-key")?.trim();
   if(!idempotencyKey||idempotencyKey.length>200)return fail(400,"INVALID_IDEMPOTENCY","Idempotency key required");
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))return fail(415,"UNSUPPORTED_MEDIA_TYPE","JSON required");
   body=await readPayload(request);
  }
  const result=await env.PINO_HO_WORLD_CORE.executeWithStaffPassword({method,path:"pinoria/worlds",...(body===undefined?{}:{body}),...(idempotencyKey===undefined?{}:{idempotencyKey})},credential.token);
  return json(result.status,result.body,result.requestId);
 }catch(e){
  if(e instanceof RangeError)return fail(413,"PAYLOAD_TOO_LARGE","World request too large");
  if(e instanceof SyntaxError)return fail(400,"INVALID_BODY","Invalid World payload");
  if(e instanceof BoShellGateError)return fail(e.status,e.code??"HO_ACCESS_DENIED",e.message);
  return fail(503,"HO_WORLD_UNAVAILABLE","HO World request unavailable");
 }
}
