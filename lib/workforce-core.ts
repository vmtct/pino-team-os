export interface WorkforceRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface WorkforceResponse{status:number;body:unknown;requestId:string}
export interface WorkforceTransportContext{serverObservedIp?:string}
export interface WorkforceCoreBinding{execute?(request:WorkforceRequest,identity:import("./team-auth").VerifiedTeamIdentity,transport?:WorkforceTransportContext):Promise<WorkforceResponse>;executeWithStaffPassword(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>;executeWithStaffPin(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>}
export function callWorkforceCoreWithStaffPassword(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPassword(request,token,transport);}
export function callWorkforceCoreWithStaffPin(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPin(request,token,transport);}

export function callWorkforceCoreWithCredential(binding:WorkforceCoreBinding,request:WorkforceRequest,credential:import("./team-auth").TeamCredential,transport:WorkforceTransportContext={}){if(credential.kind==="password")return binding.executeWithStaffPassword(request,credential.token,transport);if(!binding.execute)throw new Error("WORKFORCE_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");return binding.execute(request,credential.identity,transport);}
