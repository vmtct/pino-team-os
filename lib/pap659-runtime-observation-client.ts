/** PAP-659 published v1 remains byte compatible; PAP-1251 fallback v2.
 * No build/config receipt, playback ACK or session identity may be invented.
 */
type AssetStatus="READY"|"DEGRADED"|"UNKNOWN";
export type RuntimeObservationFacts =
  | Readonly<{buildDigest:string;configSource:"PUBLISHED";appliedConfigRevision:number;assetStatus:AssetStatus}>
  | Readonly<{buildDigest:string;configSource:"FALLBACK";appliedConfigRevision:0;assetStatus:AssetStatus}>;
const digest=/^[0-9a-f]{64}$/;
/** Accept genuine Core UUIDs and previously supported prefixed fixtures only. */
const canonical=/^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[a-z][a-z0-9_]*_[0-9a-f-]{8,})$/i;
const validIdentity=(id:string)=>canonical.test(id);
const v1="appliedConfigRevision,assetStatus,buildDigest,deviceId,displayId,sessionId,version";
const v2="appliedConfigRevision,assetStatus,buildDigest,configSource,deviceId,displayId,sessionId,version";
function validFacts(facts:RuntimeObservationFacts):boolean{
  return digest.test(facts.buildDigest)&&Number.isSafeInteger(facts.appliedConfigRevision)
    && (facts.configSource==="PUBLISHED"?facts.appliedConfigRevision>0:facts.configSource==="FALLBACK"&&facts.appliedConfigRevision===0)
    && ["READY","DEGRADED","UNKNOWN"].includes(facts.assetStatus);
}
export function makeRuntimeObservation(identity:{sessionId:string;displayId:string;deviceId:string|null},facts:RuntimeObservationFacts|null):unknown|null{
  if(!facts||!identity.deviceId||!validIdentity(identity.deviceId)||!validIdentity(identity.sessionId)||!validIdentity(identity.displayId))return null;
  if(!validFacts(facts))return null;
  const {configSource,...data}=facts;
  return configSource==="FALLBACK"
    ?{version:2,...identity,...data,configSource:"FALLBACK"}
    :{version:1,...identity,...data};
}
export async function sendRuntimeObservation(endpoint:string,observation:unknown,fetcher:typeof fetch=fetch):Promise<boolean>{
  if(!observation||typeof observation!=="object"||Array.isArray(observation))return false;
  const value=observation as Record<string,unknown>;
  const keys=Object.keys(value).sort().join(",");
  const v1Published=value.version===1&&keys===v1;
  const v2Fallback=value.version===2&&keys===v2&&value.configSource==="FALLBACK";
  if(!v1Published&&!v2Fallback)return false;
  if(typeof value.sessionId!=="string"||!validIdentity(value.sessionId)||
    typeof value.displayId!=="string"||!validIdentity(value.displayId)||
    typeof value.deviceId!=="string"||!validIdentity(value.deviceId)||
    typeof value.buildDigest!=="string"||!digest.test(value.buildDigest)||
    typeof value.appliedConfigRevision!=="number"||!Number.isSafeInteger(value.appliedConfigRevision)||
    (value.version===1?value.appliedConfigRevision<1:value.appliedConfigRevision!==0)||
    !["READY","DEGRADED","UNKNOWN"].includes(String(value.assetStatus)))return false;
  try{const result=await fetcher(endpoint,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(observation)});
    if(!result.ok)return false;
    const payload:unknown=await result.json().catch(()=>null);
    if(!payload||typeof payload!=="object"||Array.isArray(payload))return false;
    const data=(payload as {data?:unknown}).data;
    return !!data&&typeof data==="object"&&!Array.isArray(data)&&(data as Record<string,unknown>).persisted===true&&(data as Record<string,unknown>).valid===true&&(data as Record<string,unknown>).rendererAcknowledged===false;
  }catch{return false;}
}
