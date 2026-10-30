import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { BO_SIDEBAR_MODULES } from "@/lib/bo-sidebar-routes";
import { retiredSalaryPeriodRedirectUrl } from "@/lib/bo-url-contract";
import { BoRuntimeEntry } from "./components/registration/BoRuntimeBoundary";

export default async function BoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const options = Object.fromEntries(["centerId", "from", "to"].flatMap(key => typeof query[key] === "string" ? [[key, query[key]]] : []));
  if (query.module === "salaryPeriods") redirect(retiredSalaryPeriodRedirectUrl(query));
  if (query.module !== undefined && (typeof query.module !== "string" || !BO_SIDEBAR_MODULES.includes(query.module))) redirect("/bo");
  // PAP-1075: explicit non-default, staging-host-only pilot. The canonical
  // Parents URL, every other module, and Production keep the existing renderer.
  const parentTddPilot = query.module === "parents" && query.pilot === "tdd" &&
    (await headers()).get("host")?.split(":")[0] === "bo.staging.pinohouse.art";
  return <BoRuntimeEntry moduleKey={typeof query.module === "string" ? query.module : "students"} options={options} parentTddPilot={parentTddPilot} />;
}
