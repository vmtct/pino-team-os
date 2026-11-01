import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import type { WorkforcePlanningCoreBinding } from "./bo-workforce-planning-handler";

export interface HoGlobalTermWeeksEnv extends HoEnv {
  PINO_WORKFORCE_CORE: WorkforcePlanningCoreBinding;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
export type HoTermWeekRow={
  id:string;termId:string;name:string;code:string;ordinal:number;
  startDate:string;endDate:string;rhythmKey:string;updatedAt:string;
};
export function parseGlobalTermWeeksResponse(body:unknown):HoTermWeekRow[]|null {
  if(!body||typeof body!=="object"||!("data" in body))return null;
  const data=(body as {data?:unknown}).data;
  if(!data||typeof data!=="object")return null;
  const d=data as Record<string,unknown>;
  if(!Array.isArray(d.terms)||!Array.isArray(d.termWeeks))return null;
  const terms=new Map<string,string>();
  for(const item of d.terms){
    if(!item||typeof item!=="object")return null;
    const t=item as Record<string,unknown>;
    if(!uuid.test(String(t.id))||t.scopeType!=="GLOBAL"||typeof t.displayName!=="string")return null;
    terms.set(String(t.id),t.displayName);
  }
  const weeks:HoTermWeekRow[]=[];
  for(const item of d.termWeeks){
    if(!item||typeof item!=="object")return null;
    const w=item as Record<string,unknown>;
    if(!uuid.test(String(w.id))||!uuid.test(String(w.termId))||!terms.has(String(w.termId))||
      typeof w.code!=="string"||!Number.isSafeInteger(w.ordinal)||
      typeof w.rhythmKey!=="string"||typeof w.updatedAt!=="string"||
      !date.test(String(w.startDate))||!date.test(String(w.endDate)))return null;
    weeks.push({
      id:String(w.id),termId:String(w.termId),name:terms.get(String(w.termId))+" · "+String(w.code),
      code:String(w.code),ordinal:Number(w.ordinal),startDate:String(w.startDate),
      endDate:String(w.endDate),rhythmKey:String(w.rhythmKey),updatedAt:String(w.updatedAt),
    });
  }
  return weeks.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.ordinal-b.ordinal||a.id.localeCompare(b.id));
}
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function handleHoGlobalTermWeeksRead(request:Request,env:HoGlobalTermWeeksEnv):Promise<Response> {
  try{
    const url=new URL(request.url);
    if(env.APP_ENV!=="staging"||
      normalizeHostname(request.headers.get("host")||url.hostname)!==HO_STAGING_HOSTNAME||
      url.pathname!=="/api/ho/workforce/global-termweeks")
      return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
    if(request.method!=="GET")return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId||!actor.permissionKeys.includes("operating_cycle.global_week.lock"))
      return json({error:{code:"HO_GLOBAL_WEEK_VIEW_DENIED"}},403);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return json({error:{code:"IDENTITY_UNAUTHORIZED"}},401);
    const response=await env.PINO_WORKFORCE_CORE.executePlanningWithStaffPassword({
      method:"GET",path:"global-weeks/ho",body:{},
    },credential.token);
    if(response.status!==200)return json(response.body,response.status);
    const rows=parseGlobalTermWeeksResponse(response.body);
    if(!rows)return json({error:{code:"HO_GLOBAL_WEEK_DATA_INVALID"}},502);
    if(url.searchParams.get("catalog")==="1") {
      const value=(response.body as {data:{terms:unknown[]}}).data.terms;
      if(!Array.isArray(value)||value.some(item=>!item||typeof item!=="object"||
        (item as Record<string,unknown>).scopeType!=="GLOBAL"||
        !uuid.test(String((item as Record<string,unknown>).id))||
        typeof (item as Record<string,unknown>).displayName!=="string"))
        return json({error:{code:"HO_GLOBAL_TERM_CATALOG_INVALID"}},502);
      return json({data:{terms:value.map(item=>{const t=item as {id:string;displayName:string;startDate:string;endDate:string};
        return {id:t.id,name:t.displayName,startDate:t.startDate,endDate:t.endDate};}),weeks:rows}},200);
    }
    return json({data:rows},200);
  }catch(error){
    if(error instanceof BoShellGateError)return json({error:{code:"HO_ACCESS_DENIED"}},error.status);
    if(error instanceof TeamAuthError)return json({error:{code:"IDENTITY_UNAUTHORIZED"}},error.status);
    return json({error:{code:"HO_GLOBAL_WEEK_UNAVAILABLE"}},503);
  }
}
