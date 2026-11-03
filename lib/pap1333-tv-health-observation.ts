/** PAP-1333. Display only current Core-authorized TV observation, never session-only or stale facts. */
export type TvHealthObservation = Readonly<{
  configSource:"FALLBACK"|"PUBLISHED"; appliedConfigRevision:number;
  buildDigest:string;assetStatus:"READY"|"DEGRADED"|"UNKNOWN";
  observedAt:string;fresh:true;
}>;
export type TvHealthFact = Readonly<{
  observationStatus:"NONE"|"STALE"|"FRESH";
  latestObservation:TvHealthObservation|null;
}>;
export function describeTvHealthObservation(session:TvHealthFact):string {
  if(session.observationStatus==="STALE") return "Observation cũ hoặc không hợp lệ — không xác nhận config/assets hiện tại";
  const o=session.latestObservation;
  if(session.observationStatus!=="FRESH"||!o||o.fresh!==true ||
     !/^[a-f0-9]{64}$/.test(o.buildDigest) ||
     !["READY","DEGRADED","UNKNOWN"].includes(o.assetStatus) ||
     !((o.configSource==="FALLBACK"&&o.appliedConfigRevision===0) ||
       (o.configSource==="PUBLISHED"&&Number.isSafeInteger(o.appliedConfigRevision)&&o.appliedConfigRevision>0)) ||
     !Number.isFinite(Date.parse(o.observedAt)))
    return "Chưa có observation runtime được Core xác thực";
  return `${o.configSource} v${o.configSource==="FALLBACK"?"2":"1"} · revision ${o.appliedConfigRevision} · build ${o.buildDigest.slice(0,12)} · assets ${o.assetStatus} · observed ${o.observedAt} (fresh, không phải renderer ACK)`;
}
