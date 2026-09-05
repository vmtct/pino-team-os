export interface FounderRequest { method:string;path:string;body?:unknown;idempotencyKey?:string }
export interface FounderResponse { status:number;body:unknown;requestId:string }
export interface FounderActorContext { actorType:"founder";subject:string;email?:string }
export interface PinoCoreBinding {
  execute?(request:FounderRequest,actor:FounderActorContext):Promise<FounderResponse>;
  executeWithStaffPassword(request:FounderRequest,token:string):Promise<FounderResponse>;
}
export function callFounderCoreWithStaffPassword(binding:PinoCoreBinding,request:FounderRequest,token:string):Promise<FounderResponse>{
  return binding.executeWithStaffPassword(request,token);
}

export function callFounderCore(binding:PinoCoreBinding,request:FounderRequest,actor:FounderActorContext):Promise<FounderResponse>{if(!binding.execute)throw new Error("FOUNDER_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");return binding.execute(request,actor);}
