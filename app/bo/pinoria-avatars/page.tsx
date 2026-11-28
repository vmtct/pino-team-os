import { AvatarDirectoryDsa } from "./AvatarDirectoryDsa";
import { AvatarWorldReview } from "./AvatarWorldReview";
import { avatarWorldReviewMarker } from "./avatar-world-review-identity";
import { admitAvatarWorldStage, requestedAvatarWorldFixture } from "./avatar-world-stage-admission";
import { parseAvatarWorldStageContext } from "./avatar-world-stage-context";
import { headers } from "next/headers";
import { forbidden, notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authorizeBoShell, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";
import { teamCredentialFromHeaders } from "@/lib/team-auth";
import { callBoAccessCoreWithCredential } from "@/lib/bo-core";
// PAP-1810 · Epic PAP-1705 / PNR-AVATAR-CRUD — native BO DSA, TDD retired.
// PAP-2153: exact authenticated synthetic M1B only; ordinary directory stays live.
export const dynamic="force-dynamic";
export default async function PinoriaAvatarDirectoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const query=await searchParams;
 const requested=query.record===avatarWorldReviewMarker||(Array.isArray(query.record)&&query.record.includes(avatarWorldReviewMarker));
 if(!requested)return <AvatarDirectoryDsa />;
 if(!requestedAvatarWorldFixture(query)||typeof query.centerId!=="string")notFound();
 const centerId=query.centerId;
 const incoming=new Headers(await headers()),hostname=incoming.get("host")??"";
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoShellGateEnv&{APP_ENV?:string;BO_UI_ONLY?:string;PAP2153_AVATAR_WORLD_FIXTURE?:string}};
 if(env.APP_ENV!=="staging"||hostname!=="bo.staging.pinohouse.art"||env.PAP2153_AVATAR_WORLD_FIXTURE!=="1"||!boSkeletonEnabled(env,hostname))notFound();
 const actor=await authorizeBoShell(incoming,env).catch(()=>forbidden());
 const credential=await teamCredentialFromHeaders(incoming,env,"BO").catch(()=>forbidden());
 const scoped=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"GET",path:"context",resource:{centerId}},credential).catch(()=>forbidden());
 const authority=parseAvatarWorldStageContext(scoped,centerId);
 if(!admitAvatarWorldStage({environment:env.APP_ENV,hostname,enabled:env.PAP2153_AVATAR_WORLD_FIXTURE,query,actor,selectedCenterId:centerId,authority}))forbidden();
 return <AvatarWorldReview key={actor.userId+":"+centerId} stageCenterId={centerId}/>;
}
