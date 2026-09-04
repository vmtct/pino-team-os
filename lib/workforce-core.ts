import type{VerifiedWorkforceIdentity}from"./workforce-auth";
export interface WorkforceRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface WorkforceResponse{status:number;body:unknown;requestId:string}
export interface WorkforceCoreBinding{execute(request:WorkforceRequest,identity:VerifiedWorkforceIdentity):Promise<WorkforceResponse>;executeWithStaffPin(request:WorkforceRequest,token:string):Promise<WorkforceResponse>}
export function callWorkforceCore(binding:WorkforceCoreBinding,request:WorkforceRequest,identity:VerifiedWorkforceIdentity){return binding.execute(request,identity);}
export function callWorkforceCoreWithStaffPin(binding:WorkforceCoreBinding,request:WorkforceRequest,token:string){return binding.executeWithStaffPin(request,token);}
