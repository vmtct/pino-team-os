/** PAP-2030/PAP-2104 — private HO Wish configuration facade, no public BO permission. */
import {authorizeHoShell} from "./ho-auth";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredentialFromHeaders} from "./team-auth";
import {BoShellGateError} from "./bo-shell-gate";
import type {HoItemEnv} from "./ho-pinoria-item-handler";
const prefix="/api/ho/pinoria/pls-wish/config/";
const reads=["policies","banners","items"],writes=["savePolicy","publishPolicy","retirePolicy","saveBanner","publishBanner","retireBanner"];
const MAX=256*1024;
function json(status:number,body:unknown,requestId?:string){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string,message:string)=>json(status,{error:{code,message}});
async function readBody(r:Request):Promise<unknown>{
 const length=Number(r.headers.get("content-length")??0);if(!Number.isFinite(length)||length<0||length>MAX)throw new RangeError("Payload too large");
 if(!r.body)throw new SyntaxError("JSON required");
 const reader=r.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});let count=0,raw="";
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;count+=chunk.value.byteLength;if(count>MAX){await reader.cancel();throw new RangeError("Payload too large");}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}
 catch(e){if(e instanceof RangeError)throw e;throw new SyntaxError("Invalid JSON");}finally{reader.releaseLock();}
 const body:unknown=JSON.parse(raw);if(!body||typeof body!=="object"||Array.isArray(body))throw new SyntaxError("JSON object required");return body;
}
export async function handleHoPlsWishRequest(r:Request,env:HoItemEnv):Promise<Response>{
 const u=new URL(r.url),m=r.method.toUpperCase(),action=u.pathname.slice(prefix.length),preview=/^item-(?:preview|record)\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[1-9][0-9]*$/.test(action),read=reads.includes(action)||preview;
 if(env.APP_ENV!=="staging"||normalizeHostname(u.hostname)!==HO_STAGING_HOSTNAME||normalizeHostname(r.headers.get("host")??"")!==HO_STAGING_HOSTNAME||!u.pathname.startsWith(prefix)||u.search||(!read&&!writes.includes(action)))return fail(404,"NOT_FOUND","Not found");
 if(m!==(read?"GET":"POST"))return fail(405,"METHOD_NOT_ALLOWED","Method not allowed");
 try{
  const session=await authorizeHoShell(r.headers,env);
  if(!session.permissionKeys.includes("pinoria.wish.config.view")||(!read&&!session.permissionKeys.includes("pinoria.wish.config.manage")))return fail(403,"ACCESS_PERMISSION_DENIED","HO Wish permission required");
  if((action==="items"||preview)&&!session.permissionKeys.includes("pinoria.item.view"))return fail(403,"ACCESS_PERMISSION_DENIED","HO Item view required");
  const credential=await teamCredentialFromHeaders(r.headers,env,"BO");if(credential.kind!=="password")return fail(401,"AUTH_REQUIRED","Staff password session required");
  if(!env.PINO_HO_ITEM_CORE||typeof env.PINO_HO_ITEM_CORE.executeWithStaffPassword!=="function")return fail(503,"HO_WISH_UNAVAILABLE","Wish service unavailable");
  let body:unknown;
  if(!read){if(!/^application\/json(?:\s*;|$)/i.test(r.headers.get("content-type")??""))return fail(415,"UNSUPPORTED_MEDIA_TYPE","JSON required");body=await readBody(r);}
  const result=await env.PINO_HO_ITEM_CORE.executeWithStaffPassword({method:m,path:"pinoria/pls-wish/config/"+action,...(body===undefined?{}:{body})},credential.token);
  return json(result.status,result.body,result.requestId);
 }catch(e){if(e instanceof RangeError)return fail(413,"PAYLOAD_TOO_LARGE","Wish request too large");if(e instanceof SyntaxError)return fail(400,"INVALID_BODY","Invalid Wish payload");if(e instanceof BoShellGateError)return fail(e.status,e.code??"HO_ACCESS_DENIED",e.message);return fail(503,"HO_WISH_UNAVAILABLE","Wish request unavailable");}
}
