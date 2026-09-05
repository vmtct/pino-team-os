export interface TosLearningRequest{method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface TosLearningResponse{status:number;body:unknown;requestId:string}
export interface TosLearningCoreBinding{
  execute?(request:TosLearningRequest,identity:import("./team-auth").VerifiedTeamIdentity):Promise<TosLearningResponse>;
  executeWithStaffPin(request:TosLearningRequest,token:string):Promise<TosLearningResponse>;
  executeWithStaffPassword(request:TosLearningRequest,token:string):Promise<TosLearningResponse>;
}
export function callTosLearningCoreWithStaffPin(binding:TosLearningCoreBinding,request:TosLearningRequest,token:string){return binding.executeWithStaffPin(request,token);}
export function callTosLearningCoreWithStaffPassword(binding:TosLearningCoreBinding,request:TosLearningRequest,token:string){return binding.executeWithStaffPassword(request,token);}

export function callTosLearningCoreWithCredential(binding:TosLearningCoreBinding,request:TosLearningRequest,credential:import("./team-auth").TeamCredential){if(credential.kind==="password")return binding.executeWithStaffPassword(request,credential.token);if(!binding.execute)throw new Error("TOS_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");return binding.execute(request,credential.identity);}
