import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoGlobalTerms } from "@/lib/ho-global-terms-facade";
import type { HoGlobalTermWeeksEnv } from "@/lib/ho-global-termweeks-read-facade";
export const runtime = "nodejs";
async function handle(request: Request) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoGlobalTermWeeksEnv };
  return handleHoGlobalTerms(request, env);
}
export { handle as GET, handle as POST };
