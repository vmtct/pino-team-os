/** PAP-2423: read-only server admission for synthetic Staff review. Not mounted until route JIT. */
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {authorizeBoShell} from "@/lib/bo-shell-gate";
import {handleBoOperationalReadRequest,type BoReadEnv} from "@/lib/bo-read-handler";
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import {loadAuthorizedDirectoryCenters,type DirectoryCenterSource} from "@/app/bo/pinoria-avatars/centers";
import {parseStaffStageReview,staffStageReviewEnabled,type StaffReviewEnv} from "./staff-stage-review-route";
type Env=HoEnv&BoReadEnv&StaffReviewEnv;
export type StaffStageProof={surface:"HO";actorId:string}|{surface:"BO";actorId:string;centerId:string;centerSource:DirectoryCenterSource};
export async function authorizeStaffStageReview(input:{url:URL;headers:Headers;env:Env}):Promise<StaffStageProof>{
 if(typeof window!=="undefined")throw Error("Server Staff review admission only");
 const {url,headers,env}=input,route=parseStaffStageReview(url),host=headers.get("host")??"";
 if(!route||host!==url.host||!staffStageReviewEnabled(env,route.surface,host))throw Error("Staff review disabled");
 if(route.surface==="HO"){
  const actor=await authorizeHoShell(headers,env);
  const allowed=decideM1Preview({environment:env.APP_ENV,hostname:host,surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:!!actor.userId,featureReviewAuthorized:actor.permissionKeys.includes("team.bo.access")&&actor.permissionKeys.includes("staff.compensation.manage"),scopeAuthorized:true});
  if(!allowed.allowed)throw Error("HO Staff review denied");
  return Object.freeze({surface:"HO",actorId:actor.userId});
 }
 if(!route.centerId)throw Error("Staff review requires Center");
 const centerId=route.centerId,actor=await authorizeBoShell(headers,env);
 if(!actor.entitled||!actor.userId||!actor.permissionKeys.includes("team.bo.access"))throw Error("Staff review denied");
 const controller=new AbortController();
 try{
  const read:typeof fetch=async(resource,init)=>{
   const path=new URL(String(resource),url.origin);
   if(path.origin!==url.origin||!["/api/bo/centers","/api/bo/workforce/planning/bootstrap"].includes(path.pathname)||path.search||path.hash||init?.method!=="GET")throw Error("Unexpected Center read");
   return handleBoOperationalReadRequest(new Request(path,{method:"GET",headers,signal:controller.signal}),env,path.pathname.slice("/api/bo/".length));
  };
  const choices=await loadAuthorizedDirectoryCenters(read,controller.signal);
  if(!choices.centers.some(center=>center.id===centerId))throw Error("Staff review Center denied");
  // Existing feature reads independently enforce real scope. Never serialize actual rows to review.
  for(const path of ["workforce/staff-records","workforce/staff-registration-requests"]){
   const proofUrl=new URL("/api/bo/"+path+"?"+new URLSearchParams({centerId}),url.origin);
   const response=await handleBoOperationalReadRequest(new Request(proofUrl,{method:"GET",headers,signal:controller.signal}),env,path);
   if(!response.ok)throw Error("Staff review scope denied");
   const body:unknown=await response.json();
   if(!body||typeof body!=="object"||!("data" in body)||!Array.isArray(body.data))throw Error("Staff review scope invalid");
  }
  const current=await authorizeBoShell(headers,env),currentChoices=await loadAuthorizedDirectoryCenters(read,controller.signal);
  const allowed=decideM1Preview({environment:env.APP_ENV,hostname:host,surface:"BO",requested:true,featureEnabled:true,authenticated:current.entitled,surfaceAuthorized:current.userId===actor.userId,featureReviewAuthorized:current.permissionKeys.includes("team.bo.access"),scopeAuthorized:currentChoices.source===choices.source&&currentChoices.centers.some(center=>center.id===centerId)});
  if(!allowed.allowed)throw Error("Staff review admission denied");
  return Object.freeze({surface:"BO",actorId:actor.userId,centerId,centerSource:currentChoices.source});
 }finally{controller.abort();}
}
