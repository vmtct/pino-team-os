import { authorizeHoShell } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import { parseGlobalTermWeeksResponse, type HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
const rhythm=/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const replay=/^[a-zA-Z0-9:_-]{8,120}$/;
const updatedAt=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const response=(body:unknown,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
type EditInput={code:string;ordinal:number;startDate:string;endDate:string;rhythmKey:string;expectedUpdatedAt:string};
export function parseHoGlobalWeekUpdate(body:unknown):EditInput|null{
 if(!body||typeof body!=="object"||Array.isArray(body))return null;
 const b=body as Record<string,unknown>;
 if(Object.keys(b).length!==6||typeof b.code!=="string"||!b.code.trim()||b.code.trim().length>96||
  !Number.isSafeInteger(b.ordinal)||Number(b.ordinal)<1||
  typeof b.startDate!=="string"||!date.test(b.startDate)||
  typeof b.endDate!=="string"||!date.test(b.endDate)||b.startDate>b.endDate||
  typeof b.rhythmKey!=="string"||!rhythm.test(b.rhythmKey)||b.rhythmKey.length>96||
  typeof b.expectedUpdatedAt!=="string"||!updatedAt.test(b.expectedUpdatedAt))return null;
 for(const day of [b.startDate,b.endDate]){
  const dt=new Date(String(day)+"T00:00:00.000Z");
  if(Number.isNaN(dt.valueOf())||dt.toISOString().slice(0,10)!==day)return null;
 }
 if(Number.isNaN(new Date(b.expectedUpdatedAt).valueOf()))return null;
 return {code:b.code.trim(),ordinal:Number(b.ordinal),startDate:b.startDate,endDate:b.endDate,
  rhythmKey:b.rhythmKey,expectedUpdatedAt:b.expectedUpdatedAt};
}
export async function handleHoGlobalTermWeekUpdate(request:Request,env:HoGlobalTermWeeksEnv):Promise<Response>{
 try{
  const url=new URL(request.url);
  const match=url.pathname.match(/^\/api\/ho\/workforce\/global-termweeks\/([0-9a-f-]{36})\/update$/i);
  if(env.APP_ENV!=="staging"||normalizeHostname(request.headers.get("host")||url.hostname)!==HO_STAGING_HOSTNAME||
   !match||!uuid.test(match[1]!))return response({error:{code:"PLATFORM_NOT_FOUND"}},404);
  if(request.method!=="POST")return response({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
  if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
   !request.headers.get("content-type")?.startsWith("application/json"))return response({error:{code:"HO_REQUEST_DENIED"}},403);
  const key=request.headers.get("idempotency-key")?.trim();
  if(!key||!replay.test(key))return response({error:{code:"PLATFORM_INVALID_INPUT"}},400);
  const actor=await authorizeHoShell(request.headers,env);
  if(!actor.userId||!actor.permissionKeys.includes("operating_cycle.global_week.manage"))
   return response({error:{code:"HO_GLOBAL_WEEK_UPDATE_DENIED"}},403);
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return response({error:{code:"IDENTITY_UNAUTHORIZED"}},401);
  const input=parseHoGlobalWeekUpdate(await request.json().catch(()=>null));
  if(!input)return response({error:{code:"PLATFORM_INVALID_INPUT"}},400);
  const weekId=match[1]!;
  const core=env.PINO_WORKFORCE_CORE;
  const saved=await core.executePlanningWithStaffPassword({
   method:"POST",path:"global-weeks/ho/"+weekId+"/update",body:input,idempotencyKey:key,
  },credential.token);
  if(saved.status!==200)return response(saved.body,saved.status);
  const receipt=(saved.body as {data?:unknown}|null)?.data as Record<string,unknown>|undefined;
  if(!receipt||receipt.id!==weekId||receipt.updatedAt===input.expectedUpdatedAt||
   Object.entries(input).some(([k,v])=>k!=="expectedUpdatedAt"&&receipt[k]!==v))
   return response({error:{code:"HO_GLOBAL_WEEK_CONFIRMATION_FAILED"}},502);
  const readback=await core.executePlanningWithStaffPassword({
   method:"GET",path:"global-weeks/ho",body:{},
  },credential.token);
  if(readback.status!==200)return response(readback.body,readback.status);
  const rows=parseGlobalTermWeeksResponse(readback.body);
  const row=rows?.find(w=>w.id===weekId);
  if(!row||row.updatedAt!==receipt.updatedAt||row.updatedAt===input.expectedUpdatedAt||
   Object.entries(input).some(([k,v])=>k!=="expectedUpdatedAt"&&(row as unknown as Record<string,unknown>)[k]!==v))
   return response({error:{code:"HO_GLOBAL_WEEK_READBACK_MISMATCH"}},502);
  return response({data:row},200);
 }catch(error){
  if(error instanceof BoShellGateError)return response({error:{code:"HO_ACCESS_DENIED"}},error.status);
  if(error instanceof TeamAuthError)return response({error:{code:"IDENTITY_UNAUTHORIZED"}},error.status);
  return response({error:{code:"HO_GLOBAL_WEEK_UNAVAILABLE"}},503);
 }
}
