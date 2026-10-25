import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { BoShellGateError } from "@/lib/bo-shell-gate";
import "./ho-theme.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Head Office · PINO House" };
export default async function HoLayout({ children }: { children: React.ReactNode }) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoEnv };
    await authorizeHoShell(new Headers(await headers()), env);
  } catch (error) {
    if (error instanceof BoShellGateError && error.status === 404) notFound();
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED") redirect("/staff-password/change");
    if (error instanceof BoShellGateError && error.status === 401) redirect("/staff-login");
    forbidden();
  }
  return children;
}
