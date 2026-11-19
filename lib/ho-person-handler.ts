/** PAP-2180 / PAP-2178: exact staging-only, read-only HO Person facade. */
import {authorizeHoShell} from "./ho-auth";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredentialFromHeaders} from "./team-auth";
import {BoShellGateError} from "./bo-shell-gate";
import type {HoWorldEnv} from "./ho-world-handler";
const root="/api/ho/identity/persons",id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function json(status:number,body:unknown,requestId?:string){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",...(requestId?{"x-request-id":requestId}:{})}});}
const fail=(status:number,code:string)=>json(status,{error:{code,message:"Person request unavailable"}});
export async function handleHoPersonRequest(request:Request,env:HoWorldEnv):Promise<Response>{
 const u=new URL(request.url);
 if(env.APP_ENV!=="staging"||normalizeHostname(u.hostname)!==HO_STAGING_HOSTNAME||normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME)return fail(404,"NOT_FOUND");
 const suffix=u.pathname===root?null:u.pathname.startsWith(root+"/")?u.pathname.slice(root.length+1):"";
 if(suffix!==null&&suffix!=="unlinked-counts"&&!id.test(suffix))return fail(404,"NOT_FOUND");
 if(request.method!=="GET")return fail(405,"METHOD_NOT_ALLOWED");
 if(request.body||request.headers.has("idempotency-key"))return fail(400,"INVALID_INPUT");
 for(const key of u.searchParams.keys()){
  if(suffix!==null||!["q","after","limit"].includes(key)||u.searchParams.getAll(key).length!==1)return fail(400,"INVALID_INPUT");
  const value=u.searchParams.get(key)!;
  if(key==="q"&&(value.length>120||[...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))||key==="after"&&!id.test(value)||key==="limit"&&(!/^[1-9][0-9]{0,2}$/.test(value)||Number(value)>100))return fail(400,"INVALID_INPUT");
 }
 try{
  const session=await authorizeHoShell(request.headers,env);
  if(!session.permissionKeys.includes("identity.person.ho_view"))return fail(403,"ACCESS_PERMISSION_DENIED");
  const credential=await teamCredentialFromHeaders(request.headers,env,"BO");
  if(credential.kind!=="password")return fail(401,"AUTH_REQUIRED");
  if(!env.PINO_HO_WORLD_CORE||typeof env.PINO_HO_WORLD_CORE.executeWithStaffPassword!=="function")return fail(503,"HO_PERSON_CORE_NOT_CONFIGURED");
  const result=await env.PINO_HO_WORLD_CORE.executeWithStaffPassword({method:"GET",path:u.pathname.slice("/api/ho/".length)+u.search},credential.token);
  return json(result.status,result.body,result.requestId);
 }catch(error){if(error instanceof BoShellGateError)return fail(error.status,error.code??"HO_ACCESS_DENIED");return fail(503,"HO_PERSON_UNAVAILABLE");}
}
