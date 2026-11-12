/** PAP-1753 · Epic PAP-650 PNR-TV. Staff-authenticated, Center-filtered metadata only.
 * Core already checks Staff proof, TOS surface and pinoria.tv.visibility.list.
 * Never infer Viewer capability or materialize private config/player URLs.
 */
import type {LogicalTvListItem} from "./pnr-tv-logical-visibility";

type Transport=typeof fetch;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tvId=/^tvp1-(?:default|center-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
function invalid():never{throw new Error("Không thể xác minh danh sách TV của Center.");}

/** An API 200 is meaningful only if its Center and every metadata item match
 * the strict no-Viewer read contract. Reject the whole list on partial/corrupt source.
 */
export function parseStaffTvRead(value:unknown,selectedCenterId:string):readonly LogicalTvListItem[]{
 if(!uuid.test(selectedCenterId)||!object(value)||!object(value.data))return invalid();
 const data=value.data;
 if(data.centerId!==selectedCenterId||!Array.isArray(data.policies)||data.policies.length>50)return invalid();
 const seen=new Set<string>();
 return data.policies.map((raw:unknown)=>{
  if(!object(raw)||Object.keys(raw).sort().join(",")!=="id,name,scope"||
     typeof raw.id!=="string"||!tvId.test(raw.id)||
     typeof raw.name!=="string"||!raw.name.trim()||raw.name.length>200||
     (raw.scope!=="CENTER"&&raw.scope!=="DEFAULT")||seen.has(raw.id))return invalid();
  seen.add(raw.id);
  return {tvId:raw.id,name:raw.name,visibilityScope:raw.scope,
    // Core has already filtered CENTER assignments against selectedCenterId.
    // This is a *selected-Center* projection, not a global assignment list.
    centerIds:raw.scope==="CENTER"?[selectedCenterId]:[]} as LogicalTvListItem;
 });
}

export async function readStaffStationTvs(
 selectedCenterId:string,authorizedCenterIds:readonly string[],
 options:{transport?:Transport;signal?:AbortSignal}={},
):Promise<readonly LogicalTvListItem[]>{
 if(!uuid.test(selectedCenterId)||!authorizedCenterIds.includes(selectedCenterId))return invalid();
 const transport=options.transport??fetch;
 const url="/api/tos-learning/pinoria/tv-policies/visible?centerId="+encodeURIComponent(selectedCenterId);
 const response=await transport(url,{method:"GET",cache:"no-store",credentials:"same-origin",
  ...(options.signal?{signal:options.signal}:{})});
 if(!response.ok)return invalid(); // HTTP 400/401/403/404 fail closed; never fake a list.
 return parseStaffTvRead(await response.json() as unknown,selectedCenterId);
}
