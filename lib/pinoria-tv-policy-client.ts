/** PAP-660 BO-only client for immutable Core Projection Policy versions. */
export type PolicyScope = { kind:"DEFAULT" } | { kind:"CENTER"; centerId:string };
export const KINDS = [
  "ARRIVAL", "QUICK_CHOICE", "DEPARTURE", "WISH_REVEAL",
  "EGG_HATCH", "COMPANION_RITUAL", "ONBOARDING_CEREMONY",
] as const;
export type PolicyKind = typeof KINDS[number];
export const FIELDS = ["name","path","room","companion","pls","fruit","highlight"] as const;
export type Field = typeof FIELDS[number];
export type EventRule = {
  enabled:boolean; priority:number; maxAgeSeconds:number; suppressInQuietMode:boolean;
};
export type ProjectionPolicy = {
  schemaVersion:1; quietMode:boolean;
  events:Record<PolicyKind,EventRule>;
  visibleContext:Record<Field,boolean>;
};
export type PolicyVersion = {id:string;revision:number;createdBy:string;createdAt:string;applied:boolean};
export type PolicyHead = {revision:number;active_version_id:string|null};
export type VersionDetail = {id:string;revision:number;applied:boolean;configuration:ProjectionPolicy};
const ROOT="/api/bo/pinoria/tv-config/policy/";
export function defaultPolicy():ProjectionPolicy {
  const base=(priority:number,maxAgeSeconds:number,suppressInQuietMode:boolean):EventRule =>
    ({enabled:true,priority,maxAgeSeconds,suppressInQuietMode});
  return {
    schemaVersion:1,quietMode:false,
    events:{
      ARRIVAL:base(50,120,false), QUICK_CHOICE:base(60,60,true),
      DEPARTURE:base(50,120,false), WISH_REVEAL:base(70,300,true),
      EGG_HATCH:base(70,300,true), COMPANION_RITUAL:base(60,300,true),
      ONBOARDING_CEREMONY:base(70,300,true),
    },
    visibleContext:{name:true,path:true,room:false,companion:true,pls:false,fruit:false,highlight:false},
  };
}
export function policyIssues(p:ProjectionPolicy):string[] {
  const issues:string[]=[];
  if(p.schemaVersion!==1||typeof p.quietMode!=="boolean")issues.push("Invalid policy schema");
  for(const kind of KINDS){
    const v=p.events[kind];
    if(!v||typeof v.enabled!=="boolean"||typeof v.suppressInQuietMode!=="boolean"
      ||!Number.isSafeInteger(v.priority)||v.priority<0||v.priority>100
      ||!Number.isSafeInteger(v.maxAgeSeconds)||v.maxAgeSeconds<1||v.maxAgeSeconds>86400)
      issues.push("Invalid "+kind+" event rule");
  }
  for(const k of FIELDS)if(typeof p.visibleContext[k]!=="boolean")issues.push("Missing privacy flag "+k);
  return issues;
}
export function safeDemoProjection(
  p:ProjectionPolicy,kind:PolicyKind,now:Date,
):{allowed:boolean;priority:number;context:Partial<Record<Field,string|number>>} {
  const rule=p.events[kind];
  if(!rule||!rule.enabled||(p.quietMode&&rule.suppressInQuietMode)||!Number.isFinite(now.getTime()))
    return{allowed:false,priority:rule?.priority??0,context:{}};
  const demo:Record<Field,string|number>={
    name:"Piner Demo",path:"ART",room:"Studio A",companion:"MORI",
    pls:70,fruit:3,highlight:"Creative journey",
  };
  const context:Partial<Record<Field,string|number>>={};
  for(const k of FIELDS)if(p.visibleContext[k])context[k]=demo[k];
  return{allowed:true,priority:rule.priority,context};
}
export function policyReadPath(action:"head"|"versions"|"version"|"active",scope:PolicyScope,versionId?:string){
  const params=new URLSearchParams();
  if(action==="active"){
    if(scope.kind!=="CENTER")throw new Error("Center required for active policy");
    params.set("centerId",scope.centerId);
  }else{
    params.set("scope",scope.kind);
    if(scope.kind==="CENTER")params.set("centerId",scope.centerId);
    if(action==="version"){
      if(!versionId)throw new Error("Version ID required");
      params.set("versionId",versionId);
    }
  }
  return ROOT+action+"?"+params.toString();
}
async function read<T>(request:Promise<Response>):Promise<T>{
  const response=await request;
  let result:unknown;
  try{result=await response.json()}catch{throw new Error("Policy service returned invalid JSON")}
  const body=result as {data?:T;error?:{message?:string}};
  if(!response.ok)throw new Error(body?.error?.message??"Policy operation failed");
  if(!body||!("data" in body))throw new Error("Policy response missing data");
  return body.data as T;
}
export const tvPolicyApi={
  head:(scope:PolicyScope)=>read<PolicyHead|null>(fetch(policyReadPath("head",scope),{cache:"no-store"})),
  versions:(scope:PolicyScope)=>read<PolicyVersion[]>(fetch(policyReadPath("versions",scope),{cache:"no-store"})),
  version:(scope:PolicyScope,id:string)=>read<VersionDetail|null>(fetch(policyReadPath("version",scope,id),{cache:"no-store"})),
  active:(centerId:string)=>read<{configuration:ProjectionPolicy;scope:string;appliedVersion:string|null}>(
    fetch(policyReadPath("active",{kind:"CENTER",centerId}),{cache:"no-store"})),
  write:(command:"drafts"|"publish"|"revert",body:unknown)=>read<Record<string,unknown>>(fetch(ROOT+command,{
    method:"POST",cache:"no-store",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
    body:JSON.stringify(body),
  })),
};
