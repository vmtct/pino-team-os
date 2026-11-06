/** PAP-945 / PAP-938: deployment opt-in only; never permission authority. */
import {authorizeTosV4Staging,TosV4GateError,type TosV4GateEnv} from "./tos-v4-staging-gate";
import {teamCredentialFromHeaders} from "./team-auth";
import {callTosLearningCoreWithCredential,type TosLearningCoreBinding} from "./tos-learning-core";
import {tosV4StagingHost} from "./tos-v4-staging-host";

export type ClassroomSeamEnv=TosV4GateEnv&{
 PAP945_CLASSROOM_READ_ONLY?:string;
 PINO_TOS_LEARNING_CORE:TosLearningCoreBinding;
};
export async function classroomSeamEnv(
 load:()=>Promise<ClassroomSeamEnv>,headers:Headers,
 runtime:{NODE_ENV?:string;APP_ENV?:string;PAP945_CLASSROOM_READ_ONLY?:string}=process.env,
){
 try{return await load()}
 catch(error){
  // Only an explicitly local/dev, disabled seam may survive absent CF context.
  // Never catch authorization or domain failures here.
  if(runtime.NODE_ENV==="development"&&runtime.APP_ENV!=="staging"&&
   runtime.PAP945_CLASSROOM_READ_ONLY!=="true"&&!tosV4StagingHost(headers.get("host")||""))return null;
  throw error;
 }
}
export async function classroomVNextSeam(headers:Headers,env:ClassroomSeamEnv,now=new Date()){
 // Disabled means the exact legacy route; no identity or domain reads.
 if(env.PAP945_CLASSROOM_READ_ONLY!=="true")return null;
 const context=await authorizeTosV4Staging(headers,env);
 // Select only a Core-projected Center. URL/query state is never an input.
 if(!Array.isArray(context.centers))throw new TosV4GateError(403,"CLASSROOM_CENTER_UNAVAILABLE");
 const center:unknown=context.centers[0];
 if(typeof center!=="object"||center===null||Array.isArray(center)||
  !("id" in center)||typeof center.id!=="string"||!center.id||
  !("timeZone" in center)||typeof center.timeZone!=="string"||!center.timeZone)
  throw new TosV4GateError(403,"CLASSROOM_CENTER_UNAVAILABLE");
 let localDate:string;
 try{localDate=new Intl.DateTimeFormat("en-CA",{timeZone:center.timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now)}
 catch{throw new TosV4GateError(403,"CLASSROOM_CENTER_INVALID")}
 const scope={centerId:center.id,localDate};
 // Core enforces roster permission, Staff role and Center on the server before mount.
 const credential=await teamCredentialFromHeaders(headers,env,"TOS");
 let result;
 try{result=await callTosLearningCoreWithCredential(env.PINO_TOS_LEARNING_CORE,{method:"GET",path:"/classroom/day",body:scope},credential)}
 catch{throw new TosV4GateError(503,"CLASSROOM_CORE_UNAVAILABLE")}
 if(result.status!==200)throw new TosV4GateError(result.status,"CLASSROOM_READ_DENIED");
 const body=result.body as {data?:{centerId?:unknown;localDate?:unknown;occurrences?:unknown}}|null;
 if(body?.data?.centerId!==scope.centerId||body.data.localDate!==localDate||!Array.isArray(body.data.occurrences))
  throw new TosV4GateError(403,"CLASSROOM_SCOPE_INVALID");
 return scope;
}
