/** Runtime observation requires independently known facts; never manufacture a build/config receipt. */
export type RuntimeObservationFacts=Readonly<{buildDigest:string;appliedConfigRevision:number;assetStatus:"READY"|"DEGRADED"|"UNKNOWN"}>;
const digest=/^[0-9a-f]{64}$/;
export function makeRuntimeObservation(identity:{sessionId:string;displayId:string;deviceId:string|null},facts:RuntimeObservationFacts|null):unknown|null{
  if(!facts||!identity.deviceId||!identity.sessionId||!identity.displayId)return null;
  if(!digest.test(facts.buildDigest)||!Number.isSafeInteger(facts.appliedConfigRevision)||facts.appliedConfigRevision<1)return null;
  if(!["READY","DEGRADED","UNKNOWN"].includes(facts.assetStatus))return null;
  return {version:1,sessionId:identity.sessionId,displayId:identity.displayId,deviceId:identity.deviceId,...facts};
}
export async function sendRuntimeObservation(endpoint:string,observation:unknown,fetcher:typeof fetch=fetch):Promise<boolean>{
  // A transport helper must never forward caller-created ACK fields or incomplete telemetry.
  if(!observation||typeof observation!=="object"||Array.isArray(observation))return false;
  const value=observation as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="appliedConfigRevision,assetStatus,buildDigest,deviceId,displayId,sessionId,version")return false;
  if(value.version!==1||typeof value.sessionId!=="string"||!value.sessionId||typeof value.displayId!=="string"||!value.displayId||typeof value.deviceId!=="string"||!value.deviceId||typeof value.buildDigest!=="string"||!digest.test(value.buildDigest)||typeof value.appliedConfigRevision!=="number"||!Number.isSafeInteger(value.appliedConfigRevision)||value.appliedConfigRevision<1||!["READY","DEGRADED","UNKNOWN"].includes(String(value.assetStatus)))return false;
  try{const result=await fetcher(endpoint,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(observation)});
    return result.ok;
  }catch{return false;}
}
