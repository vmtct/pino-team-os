import { notFound, redirect } from "next/navigation";
import { BO_SIDEBAR_MODULES } from "@/lib/bo-sidebar-routes";
import { retiredSalaryPeriodRedirectUrl } from "@/lib/bo-url-contract";
import {headers} from "next/headers";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {boSkeletonEnabled} from "@/lib/bo-skeleton";
import {parseRunningClassReviewQuery,runningClassSearchParams} from "./running-classes/running-class-review-query";
import { BoRuntimeEntry } from "./components/registration/BoRuntimeBoundary";

export default async function BoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if(query.module==="classes"){
    const incoming=await headers();const {env}=await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string;BO_UI_ONLY?:string}};
    if(boSkeletonEnabled(env,incoming.get("host")??"")){const target=parseRunningClassReviewQuery(runningClassSearchParams(query),true);if(!target)notFound();redirect(target);}
  }
  const options = Object.fromEntries(["centerId", "from", "to"].flatMap(key => typeof query[key] === "string" ? [[key, query[key]]] : []));
  if (query.module === "salaryPeriods") redirect(retiredSalaryPeriodRedirectUrl(query));
  // PAP-1547 / PAP-1316: invalid, retired or ambiguous BO query modules
  // must not silently land on Students or discard the requested Center.
  if (query.module !== undefined && (typeof query.module !== "string" || !BO_SIDEBAR_MODULES.includes(query.module))) notFound();
  return <BoRuntimeEntry moduleKey={typeof query.module === "string" ? query.module : "students"} options={options} />;
}
