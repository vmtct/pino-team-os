import { headers } from "next/headers";
import { notFound } from "next/navigation";
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
  const {env} = await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string;BO_UI_ONLY?:string}};
  if (host !== BO_STAGING_HOSTNAME || env.APP_ENV !== "staging" || !boSkeletonEnabled(env,host)) notFound();
  const query = await searchParams;
  if (!canonicalStaffDirectoryRoute(query)) notFound();
  const options = Object.fromEntries(["centerId","view"].flatMap(key => typeof query[key] === "string" ? [[key,query[key]]] : []));
  return <BoRuntimeEntry moduleKey="staffs" options={options} />;
}
