import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { authorizeGlobalTerms } from "@/lib/ho-global-terms-facade";
import type { HoGlobalTermWeeksEnv } from "@/lib/ho-global-termweeks-read-facade";
import { BoShellGateError } from "@/lib/bo-shell-gate";
import { TeamAuthError } from "@/lib/team-auth";
import { HoGlobalTermsTdd } from "./HoGlobalTermsTdd";
export default async function Page() {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoGlobalTermWeeksEnv };
    await authorizeGlobalTerms(new Request("https://ho.staging.pinohouse.art/ho/operating-cycle/global-terms", { headers: new Headers(await headers()) }), env);
  } catch (e) {
    if ((e instanceof BoShellGateError || e instanceof TeamAuthError) && e.status === 401) redirect("/staff-login?returnTo=%2Fho%2Foperating-cycle%2Fglobal-terms");
    if (e instanceof BoShellGateError && e.status === 404) notFound();
    forbidden();
  }
  return <HoGlobalTermsTdd />;
}
