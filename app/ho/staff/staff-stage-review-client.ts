/** PAP-2423: current actor/scope recheck for isolated synthetic Staff review. */
import {surfaceSession} from "@/lib/workspace-adapters/session";
import {parseStaffStageReview} from "./staff-stage-review-route";
import type {StaffStageProof} from "./staff-stage-review-admission.server";
export async function verifyStaffStageReview(input:{url:URL;proof:StaffStageProof;signal:AbortSignal;fetcher?:typeof fetch}){
 const {url,proof,signal,fetcher}=input,route=parseStaffStageReview(url);
 if(!route||route.surface!==proof.surface||!proof.actorId.trim()||(route.surface==="BO"&&(proof.surface!=="BO"||!route.centerId||route.centerId!==proof.centerId)))throw Error("Staff review scope denied");
 const session=surfaceSession(proof.surface,url.origin,fetcher,proof.surface==="BO"?{id:proof.centerId,source:proof.centerSource}:undefined);
 try{
  const check=async()=>{
   const actor=await session.refresh(signal);
   if(actor.userId!==proof.actorId||!session.context.authorize("team.bo.access")||(proof.surface==="HO"&&!session.context.authorize("staff.compensation.manage")))throw Error("Staff review actor denied");
  };
  await check();
  if(proof.surface==="BO"){
   for(const path of ["workforce/staff-records","workforce/staff-registration-requests"]){
    const response=await session.transport("/api/bo/"+path+"?"+new URLSearchParams({centerId:proof.centerId}),{method:"GET",signal});
    if(!response.ok)throw Error("Staff review scope denied");
    const body:unknown=await response.json();
    if(!body||typeof body!=="object"||!("data" in body)||!Array.isArray(body.data))throw Error("Staff review scope unverified");
   }
  }
  await check();signal.throwIfAborted();
  return Object.freeze({...proof});
 }finally{session.dispose();}
}
