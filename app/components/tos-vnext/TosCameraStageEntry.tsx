/** PAP-1612: feature-local server entry; only canonical TOS root may mount it. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {notFound,forbidden} from "next/navigation";
import {authorizeTosCameraStageReview} from "@/lib/pap1612-camera-stage-admission.server";
import {CAMERA_STAGE_HOST,CAMERA_STAGE_PATH,parseCameraStageReview,type CameraStageEnv} from "@/lib/pap1612-camera-stage-route";
import type {TosV4GateEnv} from "@/lib/tos-v4-staging-gate";
import {TosCameraStageReview} from "./TosCameraStageReview";
export async function TosCameraStageEntry({query}:{query:Record<string,string|string[]|undefined>}){
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:TosV4GateEnv&CameraStageEnv};
 if(incoming.get("host")!==CAMERA_STAGE_HOST.TOS)notFound();
 const url=new URL("https://"+CAMERA_STAGE_HOST.TOS+CAMERA_STAGE_PATH.TOS);
 for(const [key,value] of Object.entries(query)){if(typeof value==="string")url.searchParams.append(key,value);else if(Array.isArray(value))for(const item of value)url.searchParams.append(key,item);}
 if(!parseCameraStageReview("TOS",url,env))notFound();
 const proof=await authorizeTosCameraStageReview(url,incoming,env).catch(()=>forbidden());
 return <TosCameraStageReview key={proof.actorId+":"+proof.centerId} proof={proof}/>;
}
