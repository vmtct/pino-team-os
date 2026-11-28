/** PAP-1612: existing server-authenticated scope proof, no business write or new entitlement. */
import {authorizeBoShell} from "./bo-shell-gate";
import {handleBoOperationalReadRequest,type BoReadEnv} from "./bo-read-handler";
import {authorizeTosV4Staging,type TosV4GateEnv} from "./tos-v4-staging-gate";
import {teamCredentialFromHeaders} from "./team-auth";
import {callWorkforceCoreWithCredential} from "./workforce-core";
import {CAMERA_STAGE_HOST,parseCameraStageReview,type CameraStageEnv} from "./pap1612-camera-stage-route";
function fail():never{throw Error("Camera review admission denied");}
function data(body:unknown):unknown{return body&&typeof body==="object"&&"data" in body?body.data:undefined;}
function centerIncluded(rows:unknown,id:string){return Array.isArray(rows)&&rows.some(row=>row&&typeof row==="object"&&"id" in row&&row.id===id);}
function boAllowed(actor:Awaited<ReturnType<typeof authorizeBoShell>>){return actor.entitled&&actor.permissionKeys.includes("staff.timekeeping.view");}
export async function authorizeBoCameraStageReview(url:URL,headers:Headers,env:BoReadEnv&CameraStageEnv){
 if(typeof window!=="undefined")return fail();
 const route=parseCameraStageReview("BO",url,env);
 if(!route||headers.get("host")!==CAMERA_STAGE_HOST.BO)return fail();
 const actor=await authorizeBoShell(headers,env);
 if(!boAllowed(actor))return fail();
 async function read(path:string,query?:URLSearchParams){
  const target=new URL("/api/bo/"+path,url.origin);if(query)target.search=query.toString();
  const response=await handleBoOperationalReadRequest(new Request(target,{method:"GET",headers}),env,path);
  if(response.status!==200)return fail();
  return data(await response.json());
 }
 const centers=await read("workforce/timekeeping/centers");
 if(!centerIncluded(centers,route.centerId))return fail();
 const scoped=await read("workforce/timekeeping",new URLSearchParams({centerId:route.centerId,workDate:"2026-11-28",limit:"1"}));
 if(!scoped||typeof scoped!=="object"||!("data" in scoped)||!Array.isArray(scoped.data)||scoped.data.length>1)return fail();
 if(scoped.data.some(row=>!row||typeof row!=="object"||row.centerId!==route.centerId))return fail();
 const current=await authorizeBoShell(headers,env);
 if(current.userId!==actor.userId||!boAllowed(current)||!centerIncluded(await read("workforce/timekeeping/centers"),route.centerId))return fail();
 return Object.freeze({actorId:actor.userId,centerId:route.centerId});
}
export async function authorizeTosCameraStageReview(url:URL,headers:Headers,env:TosV4GateEnv&CameraStageEnv){
 if(typeof window!=="undefined")return fail();
 const route=parseCameraStageReview("TOS",url,env);
 if(!route||headers.get("host")!==CAMERA_STAGE_HOST.TOS)return fail();
 const credential=await teamCredentialFromHeaders(headers,env,"TOS");
 if(credential.kind!=="password")return fail();
 const actor=await authorizeTosV4Staging(headers,env);
 if(actor.founderMode===true||typeof actor.staffMemberId!=="string"||!actor.staffMemberId||!centerIncluded(actor.centers,route.centerId))return fail();
 const proof=await callWorkforceCoreWithCredential(env.PINO_WORKFORCE_CORE,{method:"GET",path:"/timekeeping/current",body:{centerId:route.centerId}},credential);
 const own=data(proof.body);
 if(proof.status!==200||own===undefined||(own!==null&&(typeof own!=="object"||!("centerId" in own)||own.centerId!==route.centerId)))return fail();
 const current=await authorizeTosV4Staging(headers,env);
 if(current.userId!==actor.userId||current.staffMemberId!==actor.staffMemberId||current.founderMode===true||!centerIncluded(current.centers,route.centerId))return fail();
 return Object.freeze({actorId:actor.userId as string,centerId:route.centerId});
}
