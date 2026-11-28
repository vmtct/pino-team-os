import {TimekeepingView} from "./TimekeepingView";
import {TimekeepingCameraStageReview} from "./TimekeepingCameraStageReview";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import type {BoReadEnv} from "@/lib/bo-read-handler";
import {authorizeBoCameraStageReview} from "@/lib/pap1612-camera-stage-admission.server";
import {CAMERA_STAGE_HOST,CAMERA_STAGE_PATH,parseCameraStageReview,type CameraStageEnv} from "@/lib/pap1612-camera-stage-route";
export const dynamic="force-dynamic";
export default async function TimekeepingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 if(!("cameraReview" in query))return <TimekeepingView/>;
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoReadEnv&CameraStageEnv};
 if(incoming.get("host")!==CAMERA_STAGE_HOST.BO)notFound();
 const url=new URL("https://"+CAMERA_STAGE_HOST.BO+CAMERA_STAGE_PATH.BO);
 for(const [key,value] of Object.entries(query)){if(typeof value==="string")url.searchParams.append(key,value);else if(Array.isArray(value))for(const item of value)url.searchParams.append(key,item);}
 if(!parseCameraStageReview("BO",url,env))notFound();
 const proof=await authorizeBoCameraStageReview(url,incoming,env).catch(()=>forbidden());
 return <TimekeepingCameraStageReview key={proof.actorId+":"+proof.centerId} proof={proof}/>;
}
