import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";
import { BoRuntimeEntry } from "../components/registration/BoRuntimeBoundary";
import { canonicalParentRoute } from "./parent-route";

/** PAP-2389 / SCH-PARENTS-GUARDIANS — same native Parent runtime, existing BO shell authorization. */
export default async function ParentsPage({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
  const host = (await headers()).get("host") ?? "";
  const {env} = await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string;BO_UI_ONLY?:string}};
  if (!boSkeletonEnabled(env,host)) notFound();
  const query = await searchParams;
  if (!canonicalParentRoute(query)) notFound();
  const options: Record<string,string> = typeof query.centerId === "string" ? {centerId:query.centerId} : {};
  return <BoRuntimeEntry moduleKey="parents" options={options}/>;
}
