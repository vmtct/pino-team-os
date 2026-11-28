/** PAP-1612: presentation recheck only, existing BFF independently authorizes all reads. */
import {parseCameraStageReview,type CameraReviewSurface} from "./pap1612-camera-stage-route";
export type CameraReviewProof={actorId:string;centerId:string};
function deny():never{throw Error("Camera review scope denied");}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))return deny();return value as Record<string,unknown>;}
function hasCenter(value:unknown,id:string){return Array.isArray(value)&&value.some(row=>row&&typeof row==="object"&&row.id===id);}
export async function verifyCameraStageClient(surface:CameraReviewSurface,url:URL,proof:CameraReviewProof,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const route=parseCameraStageReview(surface,url,{APP_ENV:"staging",BO_CAMERA_M1_REVIEW:"enabled",TOS_CAMERA_M1_REVIEW:"enabled"});
 if(!route||route.centerId!==proof.centerId||!proof.actorId||typeof window!=="undefined"&&window.location.origin!==url.origin)return deny();
 async function get(path:string){
  signal.throwIfAborted();
  const response=await fetcher(new URL(path,url.origin).toString(),{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal});
  if(response.status!==200)return deny();
  const body=record(await response.json());signal.throwIfAborted();if(!("data" in body))return deny();return body.data;
 }
 if(surface==="BO"){
  const check=async()=>{const actor=record(await get("/api/bo/context"));if(actor.userId!==proof.actorId||actor.surface!=="BO"||actor.entitled!==true||!Array.isArray(actor.permissionKeys)||!actor.permissionKeys.includes("team.bo.access")||!actor.permissionKeys.includes("staff.timekeeping.view"))return deny();if(!hasCenter(await get("/api/bo/workforce/timekeeping/centers"),route.centerId))return deny();};
  await check();
  const page=record(await get("/api/bo/workforce/timekeeping?"+new URLSearchParams({centerId:route.centerId,workDate:"2026-11-28",limit:"1"})));
  if(!Array.isArray(page.data)||page.data.length>1||page.data.some(row=>record(row).centerId!==route.centerId))return deny();
  await check();
 }else{
  const check=async()=>{const actor=record(await get("/api/workforce/context"));if(actor.userId!==proof.actorId||actor.founderMode===true||typeof actor.staffMemberId!=="string"||!actor.staffMemberId||!hasCenter(actor.centers,route.centerId))return deny();return actor.staffMemberId;};
  const staff=await check();
  const own=await get("/api/workforce/timekeeping/current?"+new URLSearchParams({centerId:route.centerId}));
  if(own!==null&&record(own).centerId!==route.centerId)return deny();
  if(await check()!==staff)return deny();
 }
 return Object.freeze({...proof});
}
