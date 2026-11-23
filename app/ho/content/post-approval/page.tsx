import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { HoPostApprovalShell } from "./HoPostApprovalShell";

/** PAP-2337 M1 synthetic-only HO editorial shell; Founder HO admission is mandatory. */
export default async function PostApprovalPage() {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoEnv };
  await authorizeHoShell(new Headers(await headers()), env);
  return <HoPostApprovalShell />;
}
