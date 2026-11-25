import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {BoOperationalView} from "../BoOperationalView";
import {boSkeletonEnabled} from "@/lib/bo-skeleton";
import {isBoStagingHost} from "@/lib/bo-skeleton-routing";
import {normalizeHostname} from "@/lib/host-boundary";
import {RunningClassStagingEntry} from "./RunningClassStagingEntry";
import {parseRunningClassReviewQuery,runningClassSearchParams} from "./running-class-review-query";
export const dynamic="force-dynamic";
export default async function BoRunningClassesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const incoming=await headers();
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string;BO_UI_ONLY?:string}};
 const host=normalizeHostname(incoming.get("host")??"");
 if(env.APP_ENV==="staging"||isBoStagingHost(host)){if(host!=="bo.staging.pinohouse.art"||!boSkeletonEnabled(env,host))notFound();}
 else return <BoOperationalView view="running-classes"/>;
 if(parseRunningClassReviewQuery(runningClassSearchParams(await searchParams))===null)notFound();
 return <RunningClassStagingEntry/>;
}
