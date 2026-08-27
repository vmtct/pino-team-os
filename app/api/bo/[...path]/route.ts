import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoOperationalReadRequest, type BoReadEnv } from "@/lib/bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "@/lib/bo-write-handler";
import { handleReviewedEnrollmentActivation, REVIEWED_ENROLLMENT_ACTIVATION_PATH, type ReviewedEnrollmentEnv } from "@/lib/f4-reviewed-enrollment-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoEnv = BoReadEnv & BoWriteEnv & ReviewedEnrollmentEnv;
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  return handleBoOperationalReadRequest(request, env, path.join("/"));
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (joined === REVIEWED_ENROLLMENT_ACTIVATION_PATH) return handleReviewedEnrollmentActivation(request, env);
  return handleBoWriteRequest(request, env, joined);
}
