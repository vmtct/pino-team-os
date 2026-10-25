import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { BoShell } from "@/app/components/tos-shell";
import { authorizeBoShell, BoShellGateError, type BoShellContext, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { BoSessionBoundary } from "./BoSessionBoundary";
import { boNavigation } from "./navigation";
import "./design-system/foundation.css";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";

export const dynamic = "force-dynamic";

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  let currentUser: BoShellContext;
  let uiOnly = false;
  try {
    const incoming = await headers();
    const requestHeaders = new Headers(incoming);
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv & { APP_ENV?: string; BO_UI_ONLY?: string } };
    currentUser = await authorizeBoShell(requestHeaders, env);
    uiOnly = boSkeletonEnabled(env, requestHeaders.get("host") || "");
  } catch (error) {
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED") redirect("/staff-password/change");
    if (error instanceof BoShellGateError && error.status === 401) redirect("/staff-login");
    console.error("BO shell authorization denied", error instanceof Error ? error.message : "unknown");
    forbidden();
  }
  if (uiOnly) redirect("/bo-skeleton/playground.html");

  return (
    <>
      <BoSessionBoundary />
      <BoShell title="PINO House" subtitle="Back Office" groups={boNavigation} currentUser={currentUser}>
        {children}
      </BoShell>
    </>
  );
}
