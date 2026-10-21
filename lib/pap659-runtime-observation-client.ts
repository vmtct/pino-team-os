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
  if(!observation)return false;
  try{const result=await fetcher(endpoint,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(observation)});
    return result.ok;
  }catch{return false;}
}
