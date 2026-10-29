import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { BoShell } from "@/app/components/tos-shell";
import { authorizeBoShell, BoShellGateError, type BoShellContext, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { BoSessionBoundary } from "./BoSessionBoundary";
import { boNavigation } from "./navigation";
import { isBoStagingRouteAdmitted } from "./architecture/bo-staging-route-policy";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";
import { BoRuntimeBoundary } from "./components/registration/BoRuntimeBoundary";

export const dynamic = "force-dynamic";

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  let currentUser: BoShellContext;
  let uiOnly = false;
  let routePath = "";
  try {
    const incoming = await headers();
    const requestHeaders = new Headers(incoming);
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv & { APP_ENV?: string; BO_UI_ONLY?: string } };
    currentUser = await authorizeBoShell(requestHeaders, env);
    uiOnly = boSkeletonEnabled(env, requestHeaders.get("host") || "");
    routePath = requestHeaders.get("x-pino-bo-runtime-path") || "";
  } catch (error) {
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED") redirect("/staff-password/change");
    if (error instanceof BoShellGateError && error.status === 401) redirect("/staff-login");
    console.error("BO shell authorization denied", error instanceof Error ? error.message : "unknown");
    forbidden();
  }
  if (uiOnly) {
    if (!isBoStagingRouteAdmitted(routePath) && routePath !== "/bo" && routePath !== "/bo/") redirect("/bo");
    // The BO authority React shell owns nav, styles and module content on all admitted staging paths.
    return <><BoSessionBoundary /><BoRuntimeBoundary currentUser={{ displayName: currentUser.displayName, email: currentUser.email }}>{children}</BoRuntimeBoundary></>;
  }

  return (
    <>
      <link rel="stylesheet" href="/bo-legacy-foundation.css" />
      <BoSessionBoundary />
      <BoShell title="PINO House" subtitle="Back Office" groups={boNavigation} currentUser={currentUser}>
        {children}
      </BoShell>
    </>
  );
}
