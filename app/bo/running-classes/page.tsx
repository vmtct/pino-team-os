import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {notFound,forbidden} from "next/navigation";
import {authorizeBoShell,type BoShellGateEnv} from "@/lib/bo-shell-gate";
import {BoOperationalView} from "../BoOperationalView";
import {boSkeletonEnabled} from "@/lib/bo-skeleton";
import {isBoStagingHost} from "@/lib/bo-skeleton-routing";
import {normalizeHostname} from "@/lib/host-boundary";
import {RunningClassStagingEntry} from "./RunningClassStagingEntry";
import {runningClassSearchParams} from "./running-class-review-query";
import {parseRunningClassStageQuery,RUNNING_CLASS_LIVE_ADMISSION} from "./running-class-stage-admission";
import {RunningClassNativeEntry} from "./RunningClassNativeEntry";
export const dynamic="force-dynamic";
export default async function BoRunningClassesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const incoming=await headers();
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoShellGateEnv&{APP_ENV?:string;BO_UI_ONLY?:string}};
 const host=normalizeHostname(incoming.get("host")??"");
 if(env.APP_ENV==="staging"||isBoStagingHost(host)){if(host!=="bo.staging.pinohouse.art"||!boSkeletonEnabled(env,host))notFound();}
 else return <BoOperationalView view="running-classes"/>;
 if(parseRunningClassStageQuery(runningClassSearchParams(await searchParams))===null)notFound();
 if(RUNNING_CLASS_LIVE_ADMISSION){
  const actor=await authorizeBoShell(new Headers(incoming),env).catch(()=>forbidden());
  return <RunningClassNativeEntry expectedActorId={actor.userId}/>;
 }
 return <RunningClassStagingEntry/>;
}
