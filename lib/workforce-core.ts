import type{VerifiedWorkforceIdentity}from"./workforce-auth";
export interface WorkforceRequest{method:string;path:string;body?:unknown}
export interface WorkforceResponse{status:number;body:unknown;requestId:string}
export interface WorkforceCoreBinding{execute(request:WorkforceRequest,identity:VerifiedWorkforceIdentity):Promise<WorkforceResponse>}
export function callWorkforceCore(binding:WorkforceCoreBinding,request:WorkforceRequest,identity:VerifiedWorkforceIdentity){return binding.execute(request,identity);}
