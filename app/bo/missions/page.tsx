import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import {authorizeBoShell} from "@/lib/bo-shell-gate";
import type {BoReadEnv} from "@/lib/bo-read-handler";
import {BoMissionsTdd} from "./BoMissionsTdd";
import {MissionAssignmentStageEntry} from "./MissionAssignmentStageReview";
import {authorizeAssignmentStageReview} from "./assignment-stage-admission.server";
import {assignmentStageReviewEnabled,assignmentStageSearchParams,assignmentStageReviewUrl,hasAssignmentStageReviewPermissions,type AssignmentStageReviewEnv} from "./assignment-stage-route";

export const dynamic="force-dynamic";
/** PAP-2425: existing native workspace; isolated review only after server-owned proof. */
export default async function MissionsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoReadEnv&AssignmentStageReviewEnv};
 if(!assignmentStageReviewEnabled(env,incoming.get("host")??""))return <BoMissionsTdd/>;
 const url=assignmentStageReviewUrl(assignmentStageSearchParams(await searchParams));
 if(!url)notFound();
 const actor=await authorizeBoShell(incoming,env).catch(()=>forbidden());
 if(!actor.entitled||!hasAssignmentStageReviewPermissions(actor.permissionKeys))forbidden();
 const admission=url.searchParams.has("centerId")?await authorizeAssignmentStageReview({url,headers:incoming,env,featureEnabled:true}).catch(()=>forbidden()):null;
 if(admission&&admission.actorId!==actor.userId)forbidden();
 return <BoMissionsTdd reviewContent={<MissionAssignmentStageEntry expectedActorId={actor.userId} admission={admission}/>}/>;
}
