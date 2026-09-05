export interface FounderRequest { method:string;path:string;body?:unknown;idempotencyKey?:string }
export interface FounderResponse { status:number;body:unknown;requestId:string }
export interface PinoCoreBinding {
  executeWithStaffPassword(request:FounderRequest,token:string):Promise<FounderResponse>;
}
export function callFounderCoreWithStaffPassword(binding:PinoCoreBinding,request:FounderRequest,token:string):Promise<FounderResponse>{
  return binding.executeWithStaffPassword(request,token);
}
