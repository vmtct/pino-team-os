import "@pino/design-system/components.css";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { BoApplicationShell } from "./shell/BoApplicationShell";
import { authorizeBoShell, BoShellGateError, type BoShellContext, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { BoSessionBoundary } from "./BoSessionBoundary";
import { isBoStagingRouteAdmitted } from "./architecture/bo-staging-route-policy";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";
import { BoRuntimeBoundary } from "./components/registration/BoRuntimeBoundary";
import {BO_RETURN_HEADER,BO_STAGING_RETURN_HOST,boStagingAuthPath,safeBoStagingReturnTo} from "@/lib/bo-staging-return-to";

export const dynamic = "force-dynamic";

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  let currentUser: BoShellContext;
  let uiOnly = false;
  let routePath = "";
  let returnTo:string|null=null;
  try {
    const incoming = await headers();
    const requestHeaders = new Headers(incoming);
    if(requestHeaders.get("host")===BO_STAGING_RETURN_HOST)returnTo=safeBoStagingReturnTo(requestHeaders.get(BO_RETURN_HEADER));
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv & { APP_ENV?: string; BO_UI_ONLY?: string } };
    currentUser = await authorizeBoShell(requestHeaders, env);
    uiOnly = boSkeletonEnabled(env, requestHeaders.get("host") || "");
    routePath = requestHeaders.get("x-pino-bo-runtime-path") || "";
  } catch (error) {
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED" && returnTo) redirect(boStagingAuthPath("/staff-password/change",returnTo));
    if (error instanceof BoShellGateError && error.status === 401 && returnTo) redirect(boStagingAuthPath("/staff-login",returnTo));
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED") redirect("/staff-password/change");
    if (error instanceof BoShellGateError && error.status === 401) redirect("/staff-login");
    console.error("BO shell authorization denied", error instanceof Error ? error.message : "unknown");
    forbidden();
  }
  if (uiOnly) {
    if (!isBoStagingRouteAdmitted(routePath) && routePath !== "/bo" && routePath !== "/bo/") redirect("/bo");
  }
  return <>
    {/* Still consumed by retained V2.3 data-grid interiors, never the outer chrome. */}
    <link rel="stylesheet" href="/bo-legacy-foundation.css" />
    <BoSessionBoundary />
    <BoRuntimeBoundary currentUser={{ displayName: currentUser.displayName, email: currentUser.email }} staging={uiOnly}>
      <BoApplicationShell currentUser={{ displayName: currentUser.displayName, email: currentUser.email }} staging={uiOnly}>
        {children}
      </BoApplicationShell>
    </BoRuntimeBoundary>
  </>;
}
