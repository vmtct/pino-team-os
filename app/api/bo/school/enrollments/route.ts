import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoSchoolEnrollments } from "@/lib/bo-school-enrollments";
import type { BoReadEnv } from "@/lib/bo-read-handler";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoReadEnv & { APP_ENV?: string; BO_UI_ONLY?: string } };
  return handleBoSchoolEnrollments(request, env);
}
