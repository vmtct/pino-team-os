import { headers } from "next/headers";
import { forbidden,notFound } from "next/navigation";
import {authorizeBoShell} from "@/lib/bo-shell-gate";
import type {BoReadEnv} from "@/lib/bo-read-handler";
import {staffStageReviewEnabled,staffStageReviewUrl,staffStageQuery,STAFF_REVIEW_QUERY,type StaffReviewEnv} from "@/app/ho/staff/staff-stage-review-route";
import {authorizeStaffStageReview} from "@/app/ho/staff/staff-stage-review-admission.server";
import {BoStaffDirectoryStageEntry} from "./StaffDirectoryStageReview";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";
import { BO_STAGING_HOSTNAME, normalizeHostname } from "@/lib/host-boundary";
import { BoRuntimeEntry } from "../../components/registration/BoRuntimeBoundary";
import { canonicalStaffDirectoryRoute } from "./staff-directory-route";
/** PAP-2411 — reuse existing authorized BO shell and exact Staff module. */
export const dynamic = "force-dynamic";
export default async function StaffDirectoryPage({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
  const incoming = await headers();
  const host = normalizeHostname(incoming.get("host") ?? "");
  const {env} = await getCloudflareContext({async:true}) as unknown as {env:BoReadEnv & StaffReviewEnv};
  if (host !== BO_STAGING_HOSTNAME || env.APP_ENV !== "staging" || !boSkeletonEnabled(env,host)) notFound();
  const query = await searchParams;
  if(Object.hasOwn(query,STAFF_REVIEW_QUERY)){
    if(!staffStageReviewEnabled(env,"BO",host))notFound();
    const url=staffStageReviewUrl("BO",staffStageQuery(query));if(!url)notFound();
    const requestHeaders=new Headers(incoming),actor=await authorizeBoShell(requestHeaders,env).catch(()=>forbidden());
    if(!actor.entitled||!actor.permissionKeys.includes("team.bo.access"))forbidden();
    const proof=url.searchParams.has("centerId")?await authorizeStaffStageReview({url,headers:requestHeaders,env}).catch(()=>forbidden()):null;
    if(proof&&(proof.surface!=="BO"||proof.actorId!==actor.userId))forbidden();
    return <BoStaffDirectoryStageEntry expectedActorId={actor.userId} proof={proof}/>;
  }
  if (!canonicalStaffDirectoryRoute(query)) notFound();
  const options = Object.fromEntries(["centerId","view"].flatMap(key => typeof query[key] === "string" ? [[key,query[key]]] : []));
  return <BoRuntimeEntry moduleKey="staffs" options={options} />;
}
