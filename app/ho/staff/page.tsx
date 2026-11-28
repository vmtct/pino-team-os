import { StaffTdd } from "./StaffTdd";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden,notFound } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { normalizeHostname } from "@/lib/host-boundary";
import {staffPhaseOneRoute} from "./staff-phase-one-route";
import {staffStageReviewEnabled,staffStageReviewUrl,staffStageQuery,STAFF_REVIEW_QUERY,type StaffReviewEnv} from "./staff-stage-review-route";
import {authorizeStaffStageReview} from "./staff-stage-review-admission.server";
import {HoStaffStageReview} from "./StaffStageReview";
export const dynamic = "force-dynamic";
// PAP-2395: same approved TDD shell, native record-only Staging after Core M2 delivery.
// Local M1 fixture tooling is not imported by the runtime page.
export default async function HoStaffPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const incoming = new Headers(await headers());
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoEnv & StaffReviewEnv };
  if(Object.hasOwn(query,STAFF_REVIEW_QUERY)){
    const host=normalizeHostname(incoming.get("host")||"");
    if(!staffStageReviewEnabled(env,"HO",host))notFound();
    const url=staffStageReviewUrl("HO",staffStageQuery(query));if(!url)notFound();
    const proof=await authorizeStaffStageReview({url,headers:incoming,env}).catch(()=>forbidden());
    if(proof.surface!=="HO")forbidden();
    return <HoStaffStageReview key={proof.actorId} proof={proof}/>;
  }
  const phaseOne=staffPhaseOneRoute(env.APP_ENV,normalizeHostname(incoming.get("host")||""),query);
  if(phaseOne==="invalid")notFound();
  if(phaseOne==="disabled")return <StaffTdd/>;
  const actor=await authorizeHoShell(incoming,env);
  if(!actor.entitled||!actor.userId||!actor.permissionKeys.includes("team.bo.access"))forbidden();
  return <StaffTdd nativePrincipalId={actor.userId} createAdmission="record-only"/>;
}