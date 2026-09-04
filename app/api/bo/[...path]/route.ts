import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoOperationalReadRequest, type BoReadEnv } from "@/lib/bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "@/lib/bo-write-handler";
import { handleBoPracticeMediaUpload, type BoPracticeMediaEnv } from "@/lib/bo-practice-media-handler";
import { handleBoWorkforcePlanningRequest, isBoWorkforcePlanningPath, type BoWorkforcePlanningEnv } from "@/lib/bo-workforce-planning-handler";
import { handleBoWorkforceTrainingRequest, isBoWorkforceTrainingPath, type BoWorkforceTrainingEnv } from "@/lib/bo-workforce-training-handler";
import { handleReviewedEnrollmentActivation, REVIEWED_ENROLLMENT_ACTIVATION_PATH, type ReviewedEnrollmentEnv } from "@/lib/f4-reviewed-enrollment-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoEnv = BoReadEnv & BoWriteEnv & BoWorkforcePlanningEnv & BoWorkforceTrainingEnv & ReviewedEnrollmentEnv & BoPracticeMediaEnv;
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoWorkforcePlanningPath(joined)) return handleBoWorkforcePlanningRequest(request, env, joined);
  return handleBoOperationalReadRequest(request, env, joined);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoWorkforcePlanningPath(joined)) return handleBoWorkforcePlanningRequest(request, env, joined);
  if (joined === REVIEWED_ENROLLMENT_ACTIVATION_PATH) return handleReviewedEnrollmentActivation(request, env);
  if (joined === "practice/media") return handleBoPracticeMediaUpload(request, env);
  return handleBoWriteRequest(request, env, joined);
}
