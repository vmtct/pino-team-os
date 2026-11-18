/** PAP-2143 / PAP-8 — private HO World facade, exact staging routes only. */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredentialFromHeaders} from "./team-auth";
import {BoShellGateError} from "./bo-shell-gate";
interface WorldRequest {method:string;path:string;body?:unknown;idempotencyKey?:string}
interface WorldResult {status:number;body:unknown;requestId:string}
export interface HoWorldEnv extends HoEnv {PINO_HO_WORLD_CORE?:{executeWithStaffPassword(request:WorldRequest,token:string):Promise<WorldResult>}}
const path="/api/ho/pinoria/worlds",canonical="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const MAX=4096,SAVE_MAX=65536,MEDIA_MAX=8*1024*1024,FORM_MAX=MEDIA_MAX+8192;
type Route={method:string;corePath:string;kind:"read"|"create"|"patch"|"createScene"|"save"|"media"};
function route(p:string,m:string):Route|null{
 const corePath=p.slice("/api/ho/".length);
 if(p===path&&(m==="GET"||m==="POST"))return{method:m,corePath,kind:m==="GET"?"read":"create"};
 if(m==="GET"&&new RegExp("^"+path+"/"+canonical+"/history$").test(p))return{method:m,corePath,kind:"read"};
 if(p===path+"/media"&&m==="POST")return{method:m,corePath,kind:"media"};
 if(m==="PATCH"&&new RegExp("^"+path+"/"+canonical+"$").test(p))return{method:m,corePath,kind:"patch"};
 if(m==="POST"&&new RegExp("^"+path+"/"+canonical+"/scenes$").test(p))return{method:m,corePath,kind:"createScene"};
 if(m==="PUT"&&new RegExp("^"+path+"/scenes/"+canonical+"/save$").test(p))return{method:m,corePath,kind:"save"};
 return null;
}
const fields={create:["key","displayName","worldType","descriptionText"],patch:["expectedVersion","displayName","worldType","descriptionText"],createScene:["expectedWorldVersion","key","displayName","descriptionText","canvasWidth","canvasHeight","baseAssetKey"],save:["expectedVersion","expectedLayers","displayName","descriptionText","baseAssetKey","layers"]};
function json(status:number,body:unknown,requestId?:string):Response{return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}})}
const fail=(status:number,code:string,message:string)=>json(status,{error:{code,message}});
async function bytes(request:Request,max:number):Promise<Uint8Array<ArrayBuffer>>{
 const length=Number(request.headers.get("content-length")??0);
 if(!Number.isFinite(length)||length<0||length>max)throw new RangeError("Payload too large");
 if(!request.body)throw new SyntaxError("Body required");
 const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>max){await reader.cancel();throw new RangeError("Payload too large")}chunks.push(next.value)}}
 finally{reader.releaseLock()}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}return result;
}
async function readPayload(request:Request,kind:keyof typeof fields):Promise<unknown>{
 const raw=await bytes(request,kind==="save"?SAVE_MAX:MAX);
 let b:unknown;try{b=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw))}catch{throw new SyntaxError("Invalid JSON")}
 if(!b||typeof b!=="object"||Array.isArray(b))throw new SyntaxError("JSON object required");
 if(Object.keys(b).some(k=>!fields[kind].includes(k)))throw new SyntaxError("Unsupported field");
 return b;
}
async function readMedia(request:Request){
 const raw=await bytes(request,FORM_MAX);
 let form:FormData;try{form=await new Response(raw,{headers:{"content-type":request.headers.get("content-type")??""}}).formData()}catch{throw new SyntaxError("Invalid multipart")}
 const file=form.get("file");if([...form.keys()].length!==1||!(file instanceof File)||file.size<1||file.size>MEDIA_MAX||!["image/png","image/gif"].includes(file.type))throw new SyntaxError("Invalid World media");
 return{fileName:file.name,mimeType:file.type,bytes:await file.arrayBuffer()};
}
export async function handleHoWorldRequest(request:Request,env:HoWorldEnv):Promise<Response>{
 const u=new URL(request.url),method=request.method.toUpperCase();
 if(env.APP_ENV!=="staging"||normalizeHostname(u.hostname)!==HO_STAGING_HOSTNAME||normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||u.search)return fail(404,"NOT_FOUND","Not found");
 const r=route(u.pathname,method);if(!r)return fail(u.pathname===path?405:404,"NOT_FOUND","Not found");
 try{
  const session=await authorizeHoShell(request.headers,env);
  const required=r.kind==="read"?"pinoria.world.view":"pinoria.world.manage";
  if(!session.permissionKeys.includes(required))return fail(403,"ACCESS_PERMISSION_DENIED","HO World permission required");
  const credential=await teamCredentialFromHeaders(request.headers,env,"BO");
  if(credential.kind!=="password")return fail(401,"AUTH_REQUIRED","Staff password session required");
  if(!env.PINO_HO_WORLD_CORE||typeof env.PINO_HO_WORLD_CORE.executeWithStaffPassword!=="function")return fail(503,"HO_WORLD_CORE_NOT_CONFIGURED","HO World unavailable");
  let body:unknown,idempotencyKey:string|undefined;
  if(r.kind!=="read"){
   if(r.kind!=="patch"){idempotencyKey=request.headers.get("idempotency-key")?.trim();if(!idempotencyKey||idempotencyKey.length>200)return fail(400,"INVALID_IDEMPOTENCY","Idempotency key required")}
   const content=request.headers.get("content-type")??"";
   if(r.kind==="media"){if(!/^multipart\/form-data(?:\s*;|$)/i.test(content))return fail(415,"UNSUPPORTED_MEDIA_TYPE","Multipart required");body=await readMedia(request)}
   else {if(!/^application\/json(?:\s*;|$)/i.test(content))return fail(415,"UNSUPPORTED_MEDIA_TYPE","JSON required");body=await readPayload(request,r.kind)}
  }
  const result=await env.PINO_HO_WORLD_CORE.executeWithStaffPassword({method:r.method,path:r.corePath,...(body===undefined?{}:{body}),...(idempotencyKey===undefined?{}:{idempotencyKey})},credential.token);
  return json(result.status,result.body,result.requestId);
 }catch(e){
  if(e instanceof RangeError)return fail(413,"PAYLOAD_TOO_LARGE","World request too large");
  if(e instanceof SyntaxError)return fail(400,"INVALID_BODY","Invalid World payload");
  if(e instanceof BoShellGateError)return fail(e.status,e.code??"HO_ACCESS_DENIED",e.message);
  return fail(503,"HO_WORLD_UNAVAILABLE","HO World request unavailable");
 }
}
