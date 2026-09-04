import type{VerifiedWorkforceIdentity}from"./workforce-auth";
export interface WorkforceRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface WorkforceResponse{status:number;body:unknown;requestId:string}
export interface WorkforceTransportContext{serverObservedIp?:string}
export interface WorkforceCoreBinding{execute(request:WorkforceRequest,identity:VerifiedWorkforceIdentity,transport?:WorkforceTransportContext):Promise<WorkforceResponse>;executeWithStaffPin(request:WorkforceRequest,token:string,transport?:WorkforceTransportContext):Promise<WorkforceResponse>}
export function callWorkforceCore(binding:WorkforceCoreBinding,request:WorkforceRequest,identity:VerifiedWorkforceIdentity,transport:WorkforceTransportContext={}){return binding.execute(request,identity,transport);}
export function callWorkforceCoreWithStaffPin(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string,transport:WorkforceTransportContext={}){return binding.executeWithStaffPin(request,token,transport);}
