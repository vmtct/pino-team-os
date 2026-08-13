export interface FounderRequest { method:string;path:string;body?:unknown;idempotencyKey?:string }
export interface FounderResponse { status:number;body:unknown;requestId:string }
export interface FounderActorContext { actorType:"founder";subject:string;email?:string }
export interface PinoCoreBinding { execute(request:FounderRequest,actor:FounderActorContext):Promise<FounderResponse> }

export function callFounderCore(binding:PinoCoreBinding,request:FounderRequest,actor:FounderActorContext):Promise<FounderResponse>{
  return binding.execute(request,actor);
}
