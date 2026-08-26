import type{VerifiedWorkforceIdentity}from"./workforce-auth";

export interface TosLearningRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface TosLearningResponse{status:number;body:unknown;requestId:string}
export interface TosLearningCoreBinding{execute(request:TosLearningRequest,identity:VerifiedWorkforceIdentity):Promise<TosLearningResponse>;executeWithStaffPin(request:TosLearningRequest,token:string):Promise<TosLearningResponse>}

export function callTosLearningCore(binding:TosLearningCoreBinding,request:TosLearningRequest,identity:VerifiedWorkforceIdentity){return binding.execute(request,identity);}
export function callTosLearningCoreWithStaffPin(binding:TosLearningCoreBinding,request:TosLearningRequest,token:string){return binding.executeWithStaffPin(request,token);}
