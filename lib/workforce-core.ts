export interface WorkforceRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface WorkforceResponse{status:number;body:unknown;requestId:string}
export interface WorkforceTransportContext{serverObservedIp?:string;expectedCoreVersionId?:string}
export interface WorkforceCoreBinding{execute?(request:WorkforceRequest,identity:import("./team-auth").VerifiedTeamIdentity,transport?:WorkforceTransportContext):Promise<WorkforceResponse>;executeWithStaffPassword(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>;executeWithStaffPin(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>}
export function callWorkforceCoreWithStaffPassword(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPassword(request,token,transport);}
export function callWorkforceCoreWithStaffPin(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPin(request,token,transport);}

export function callWorkforceCoreWithCredential(binding:WorkforceCoreBinding,request:WorkforceRequest,credential:import("./team-auth").TeamCredential,transport:WorkforceTransportContext={}){if(credential.kind==="password")return binding.executeWithStaffPassword(request,credential.token,transport);if(!binding.execute)throw new Error("WORKFORCE_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");return binding.execute(request,credential.identity,transport);}

const WFM_STAGING_HOST="pino-team-os-staging.minhtri-van42.workers.dev";
const CORE_VERSION_HEADER="x-pino-staging-core-version";
const CORE_VERSION_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function workforceTransportContextFromRequest(request:Request):WorkforceTransportContext{
  const observed=request.headers.get("cf-connecting-ip")?.trim();
  const expected=request.headers.get(CORE_VERSION_HEADER)?.trim();
  const base:WorkforceTransportContext=observed?{serverObservedIp:observed}:{};
  if(!expected)return base;
  const host=(request.headers.get("host")??new URL(request.url).hostname).split(":")[0]!.trim().toLowerCase();
  if(host!==WFM_STAGING_HOST)throw new Error("WORKFORCE_CORE_VERSION_GUARD_STAGING_HOST_REQUIRED");
  if(!CORE_VERSION_RE.test(expected))throw new Error("WORKFORCE_CORE_VERSION_GUARD_INVALID");
  return{...base,expectedCoreVersionId:expected};
}
