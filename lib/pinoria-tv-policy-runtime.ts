import type { PinoriaPresentation } from "@/app/pinoria-tv/presentation-types";
import {
  KINDS, defaultPolicy, policyIssues, type PolicyKind, type ProjectionPolicy,
} from "./pinoria-tv-policy-client";
const known=new Set<string>(KINDS);
/** A missing/corrupt config never grants an optional visibility permission. */
export function readSafeTvPolicy(value:unknown,centerId?:string):ProjectionPolicy|null {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const raw=value as {configuration?:unknown;appliedVersion?:unknown;scope?:unknown};
  if(centerId && raw.scope!=="DEFAULT" && raw.scope!=="SAFE_DEFAULT"
    && raw.scope!=="CENTER:"+centerId)return null;
  const data=raw.configuration;
  if(!data||typeof data!=="object"||Array.isArray(data))return null;
  try{
    const parsed=data as ProjectionPolicy;
    if(policyIssues(parsed).length)return null;
    if(Object.keys(parsed).sort().join(",")!=="events,quietMode,schemaVersion,visibleContext")return null;
    if(Object.keys(parsed.events).length!==KINDS.length||
      Object.keys(parsed.visibleContext).length!==7)return null;
    return parsed;
  }catch{return null}
}
export function eligibleTvEvent(
  policy:ProjectionPolicy,kind:string,at:string,now:Date,
):boolean{
  if(!known.has(kind))return false;
  const rule=policy.events[kind as PolicyKind];
  if(!rule?.enabled||(policy.quietMode&&rule.suppressInQuietMode))return false;
  const when=Date.parse(at),clock=now.getTime();
  return Number.isFinite(when)&&Number.isFinite(clock)&&clock>=when
    &&clock-when<=rule.maxAgeSeconds*1000;
}
export function displayNameForSharedTv(policy:ProjectionPolicy,name:string):string{
  return policy.visibleContext.name?name:"Piner";
}
export function defaultSharedTvPolicy():ProjectionPolicy{return defaultPolicy();}

/** Hide a real learner's name without altering the canonical presentation. */
export function redactTvPresentationName(policy:ProjectionPolicy,value:PinoriaPresentation):PinoriaPresentation {
  if(policy.visibleContext.name)return value;
  const projection={...value.projection};
  if("subject" in projection && projection.subject && typeof projection.subject==="object"
      && "displayName" in projection.subject){
    projection.subject={...projection.subject,displayName:"Piner"};
  }
  if("displayName" in projection)projection.displayName="Piner";
  return {...value,projection} as PinoriaPresentation;
}
