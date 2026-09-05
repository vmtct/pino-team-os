export interface TosLearningRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface TosLearningResponse{status:number;body:unknown;requestId:string}
export interface TosLearningCoreBinding{
  executeWithStaffPin(request:TosLearningRequest,token:string):Promise<TosLearningResponse>;
  executeWithStaffPassword(request:TosLearningRequest,token:string):Promise<TosLearningResponse>;
}
export function callTosLearningCoreWithStaffPin(binding:TosLearningCoreBinding,request:TosLearningRequest,token:string){return binding.executeWithStaffPin(request,token);}
export function callTosLearningCoreWithStaffPassword(binding:TosLearningCoreBinding,request:TosLearningRequest,token:string){return binding.executeWithStaffPassword(request,token);}
