import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { BoShell } from "@/app/components/tos-shell";
import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { boNavigation } from "./navigation";

export const dynamic = "force-dynamic";

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  try {
    const incoming = await headers();
    const requestHeaders = new Headers(incoming);
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv };
    await authorizeBoShell(requestHeaders, env);
  } catch (error) {
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PIN_ROTATION_REQUIRED") redirect("/staff-pin/change");
    console.error("BO shell authorization denied", error instanceof Error ? error.message : "unknown");
    forbidden();
  }

  return (
    <BoShell title="PINO House" subtitle="Back Office" groups={boNavigation}>
      {children}
    </BoShell>
  );
}
