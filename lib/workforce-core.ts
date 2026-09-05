export interface WorkforceRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface WorkforceResponse{status:number;body:unknown;requestId:string}
export interface WorkforceTransportContext{serverObservedIp?:string}
export interface WorkforceCoreBinding{executeWithStaffPassword(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>;executeWithStaffPin(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>}
export function callWorkforceCoreWithStaffPassword(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPassword(request,token,transport);}
export function callWorkforceCoreWithStaffPin(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPin(request,token,transport);}
