/** PAP-2225: read-only authenticated scope proof. Never return live records to the fixture. */
import {scopedClassesFetcher} from "../components/registration/BoScopedClassRead";
type Context={surface:string;entitled:boolean;permissionKeys?:readonly string[]};
export async function canReviewRunningClass(centerId:string,context:()=>Promise<Context>,fetcher:typeof fetch,signal:AbortSignal):Promise<boolean>{
 try{
  if(signal.aborted)return false;
  const ctx=await context();
  if(signal.aborted||ctx.surface!=="BO"||ctx.entitled!==true||!ctx.permissionKeys?.includes("delivery.schedule.manage"))return false;
  await scopedClassesFetcher(fetcher,centerId)("/api/bo/delivery/bootstrap-state",{signal,method:"GET",cache:"no-store"});
  return !signal.aborted;
 }catch{return false;}
}
