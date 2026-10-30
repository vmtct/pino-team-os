import { authorizeHoShell } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import type { HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";
import { parseGlobalTermWeeksResponse } from "./ho-global-termweeks-read-facade";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
const rhythm=/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const replayKey=/^[a-zA-Z0-9:_-]{8,120}$/;
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
type CreateInput={termId:string;code:string;ordinal:number;startDate:string;endDate:string;rhythmKey:string};
export function parseHoGlobalWeekCreate(body:unknown):CreateInput|null {
  if(!body||typeof body!=="object"||Array.isArray(body))return null;
  const b=body as Record<string,unknown>;
  if(Object.keys(b).length!==6||!uuid.test(String(b.termId))||
    typeof b.code!=="string"||!b.code.trim()||b.code.trim().length>96||
    !Number.isSafeInteger(b.ordinal)||Number(b.ordinal)<1||
    typeof b.startDate!=="string"||!date.test(b.startDate)||
    typeof b.endDate!=="string"||!date.test(b.endDate)||
    b.startDate>b.endDate||typeof b.rhythmKey!=="string"||
    !rhythm.test(b.rhythmKey)||b.rhythmKey.length>96)return null;
  for(const value of [b.startDate,b.endDate]) {
    const iso=new Date(String(value)+"T00:00:00.000Z");
    if(Number.isNaN(iso.valueOf())||iso.toISOString().slice(0,10)!==value)return null;
  }
  return {termId:String(b.termId),code:b.code.trim(),ordinal:Number(b.ordinal),
    startDate:b.startDate,endDate:b.endDate,rhythmKey:b.rhythmKey};
}
export async function handleHoGlobalTermWeeksCreate(request:Request,env:HoGlobalTermWeeksEnv):Promise<Response>{
  try{
    const url=new URL(request.url);
    if(env.APP_ENV!=="staging"||normalizeHostname(request.headers.get("host")||url.hostname)!==HO_STAGING_HOSTNAME||
      url.pathname!=="/api/ho/workforce/global-termweeks")return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
    if(request.method!=="POST")return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
      !request.headers.get("content-type")?.startsWith("application/json"))
      return json({error:{code:"HO_REQUEST_DENIED"}},403);
    const key=request.headers.get("idempotency-key")?.trim();
    if(!key||!replayKey.test(key))return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId||!actor.permissionKeys.includes("operating_cycle.global_week.manage"))
      return json({error:{code:"HO_GLOBAL_WEEK_CREATE_DENIED"}},403);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return json({error:{code:"IDENTITY_UNAUTHORIZED"}},401);
    const input=parseHoGlobalWeekCreate(await request.json().catch(()=>null));
    if(!input)return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
    const core=env.PINO_WORKFORCE_CORE;
    const created=await core.executePlanningWithStaffPassword({
      method:"POST",path:"global-weeks/ho",body:input,idempotencyKey:key,
    },credential.token);
    if(created.status!==201)return json(created.body,created.status);
    const result=(created.body as {data?:unknown}|null)?.data;
    if(!result||typeof result!=="object"||!uuid.test(String((result as {id?:unknown}).id)))
      return json({error:{code:"HO_GLOBAL_WEEK_CONFIRMATION_FAILED"}},502);
    const createdId=String((result as {id:string}).id);
    const readback=await core.executePlanningWithStaffPassword({
      method:"GET",path:"global-weeks/ho",body:{},
    },credential.token);
    if(readback.status!==200)return json(readback.body,readback.status);
    const rows=parseGlobalTermWeeksResponse(readback.body);
    const row=rows?.find(item=>item.id===createdId);
    if(!row||row.termId!==input.termId||row.code!==input.code||row.ordinal!==input.ordinal||
      row.startDate!==input.startDate||row.endDate!==input.endDate||row.rhythmKey!==input.rhythmKey)
      return json({error:{code:"HO_GLOBAL_WEEK_READBACK_MISMATCH"}},502);
    return json({data:row},201);
  }catch(error){
    if(error instanceof BoShellGateError)return json({error:{code:"HO_ACCESS_DENIED"}},error.status);
    if(error instanceof TeamAuthError)return json({error:{code:"IDENTITY_UNAUTHORIZED"}},error.status);
    return json({error:{code:"HO_GLOBAL_WEEK_UNAVAILABLE"}},503);
  }
}
