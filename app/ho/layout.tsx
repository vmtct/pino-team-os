import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { BoShellGateError } from "@/lib/bo-shell-gate";
import { safeHoReturnTo } from "@/lib/ho-routes";
export const dynamic = "force-dynamic";
export const metadata = { title: "Head Office · PINO House" };
export default async function HoLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = new Headers(await headers());
  const returnTo = safeHoReturnTo(requestHeaders.get("x-pino-ho-return-to"));
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoEnv };
    await authorizeHoShell(requestHeaders, env);
  } catch (error) {
    if (error instanceof BoShellGateError && error.status === 404) notFound();
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED") redirect("/staff-password/change" + (returnTo ? "?returnTo=" + encodeURIComponent(returnTo) : ""));
    if (error instanceof BoShellGateError && error.status === 401) redirect("/staff-login" + (returnTo ? "?returnTo=" + encodeURIComponent(returnTo) : ""));
    forbidden();
  }
  return children;
}
