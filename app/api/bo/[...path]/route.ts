import {handleBoSelfCreateRequest, type BoSelfCreateEnv} from "@/lib/bo-self-create-handler";
import {handleBoAvatarNicknameRequest, isBoAvatarNicknamePath, type BoAvatarNicknameEnv} from "@/lib/bo-avatar-nickname-handler";
import {handleBoBillsRequest,isBoBillsPath} from "@/lib/bo-bills-handler";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoPublicViewRequest, type BoPublicViewEnv } from "@/lib/bo-public-view-handler";
import { handleBoOperationalReadRequest, type BoReadEnv } from "@/lib/bo-read-handler";
import { handleBoSelfItemRequest, isBoSelfItemPath, type BoSelfItemEnv } from "@/lib/bo-self-item-ownership-handler";
import { handleBoSelfLoadoutRequest, isBoSelfLoadoutPath, type BoSelfLoadoutEnv } from "@/lib/bo-self-loadout-handler";
import { handleBoMissionAssignmentWrite, isBoMissionAssignmentWritePath, type BoMissionWriteEnv } from "@/lib/bo-mission-assignment-write-facade";
import { handleBoMissionCompletionRequest, isBoMissionCompletionPath, type BoMissionCompletionEnv } from "@/lib/bo-mission-completion-facade";
import { handleBoWriteRequest, type BoWriteEnv } from "@/lib/bo-write-handler";
import {handleBoSubscriptionSpecialtyRequest,isBoSubscriptionSpecialtyPath,type BoSubscriptionSpecialtyEnv} from "@/lib/bo-subscription-specialty-facade";
import { handleBoPracticeMediaUpload, type BoPracticeMediaEnv } from "@/lib/bo-practice-media-handler";
import { handleBoSyllabusMediaRequest, type BoSyllabusMediaEnv } from "@/lib/bo-syllabus-media-handler";
import { handleBoStaffPrivateDocumentRequest, isBoStaffPrivateDocumentPath, type BoStaffPrivateEnv } from "@/lib/bo-staff-private-handler";
import { handleBoWardSetMediaUpload, type BoWardSetMediaEnv } from "@/lib/bo-ward-set-media-handler";
import { handleBoPinoriaWorldMediaUpload, PINORIA_WORLD_MEDIA_PATH, type BoPinoriaWorldMediaEnv } from "@/lib/bo-pinoria-world-media-handler";
import { handleBoWorkforcePlanningRequest, isBoWorkforcePlanningPath, type BoWorkforcePlanningEnv } from "@/lib/bo-workforce-planning-handler";
import { handleBoWorkforceTrainingRequest, isBoWorkforceTrainingPath, type BoWorkforceTrainingEnv } from "@/lib/bo-workforce-training-handler";
import { handleBoWorkforceDutyExceptionRequest, isBoWorkforceDutyExceptionPath, type BoWorkforceDutyExceptionEnv } from "@/lib/bo-workforce-duty-exception-handler";
import { handleBoPayrollReviewRequest,isBoPayrollReviewPath,type BoPayrollReviewEnv } from "@/lib/bo-payroll-extra-review-handler";
import { handleBoPayrollPeriodRequest,isBoPayrollPeriodPath,type BoPayrollPeriodEnv } from "@/lib/bo-payroll-period-handler";
import { handleReviewedEnrollmentActivation, REVIEWED_ENROLLMENT_ACTIVATION_PATH, type ReviewedEnrollmentEnv } from "@/lib/f4-reviewed-enrollment-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoEnv = BoAvatarNicknameEnv & BoSubscriptionSpecialtyEnv & BoSelfCreateEnv & BoSelfLoadoutEnv & BoSelfItemEnv & BoMissionWriteEnv & BoMissionCompletionEnv & BoPublicViewEnv & BoReadEnv & BoWriteEnv & BoWorkforcePlanningEnv & BoWorkforceTrainingEnv & BoWorkforceDutyExceptionEnv & BoPayrollReviewEnv & BoPayrollPeriodEnv & ReviewedEnrollmentEnv & BoPracticeMediaEnv & BoSyllabusMediaEnv & BoStaffPrivateEnv & BoWardSetMediaEnv & BoPinoriaWorldMediaEnv;
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoSubscriptionSpecialtyPath(joined)) return handleBoSubscriptionSpecialtyRequest(request,env,joined);
  if (isBoMissionCompletionPath(joined)) return handleBoMissionCompletionRequest(request, env, joined);
  if (isBoBillsPath(joined)) return handleBoBillsRequest(request, env, joined);
  if (isBoSelfLoadoutPath(joined)) return handleBoSelfLoadoutRequest(request, env, joined);
  if (isBoSelfItemPath(joined)) return handleBoSelfItemRequest(request, env, joined);
  if (joined.startsWith("views/")) return handleBoPublicViewRequest(request, env, joined);
  if (isBoWorkforcePlanningPath(joined)) return handleBoWorkforcePlanningRequest(request, env, joined);
  if (isBoWorkforceTrainingPath(joined)) return handleBoWorkforceTrainingRequest(request, env, joined);
  if (isBoPayrollReviewPath(joined)) return handleBoPayrollReviewRequest(request, env, joined);
  if (isBoPayrollPeriodPath(joined)) return handleBoPayrollPeriodRequest(request, env, joined);
  if (isBoWorkforceDutyExceptionPath(joined)) return handleBoWorkforceDutyExceptionRequest(request, env, joined);
  if (joined === "learning/syllabi/media" || /^learning\/syllabi\/media\/[0-9a-f-]{36}\/preview$/.test(joined)) return handleBoSyllabusMediaRequest(request, env, joined);
  if (isBoStaffPrivateDocumentPath(joined)) return handleBoStaffPrivateDocumentRequest(request, env, joined);
  if (joined === "pinoria/avatars/starter-sets") return handleBoSelfCreateRequest(request, env, joined);
  return handleBoOperationalReadRequest(request, env, joined);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoSubscriptionSpecialtyPath(joined)) return handleBoSubscriptionSpecialtyRequest(request,env,joined);
  if (isBoMissionCompletionPath(joined)) return handleBoMissionCompletionRequest(request, env, joined);
  if (isBoBillsPath(joined)) return handleBoBillsRequest(request, env, joined);
  if (isBoSelfLoadoutPath(joined)) return handleBoSelfLoadoutRequest(request, env, joined);
  if (isBoSelfItemPath(joined)) return handleBoSelfItemRequest(request, env, joined);
  if (joined === "pinoria/avatars") return handleBoSelfCreateRequest(request, env, joined);
  if (joined.startsWith("views/")) return handleBoPublicViewRequest(request, env, joined);
  if (isBoMissionAssignmentWritePath(joined) && request.method !== "GET") return handleBoMissionAssignmentWrite(request, env, joined);
  if (isBoWorkforcePlanningPath(joined)) return handleBoWorkforcePlanningRequest(request, env, joined);
  if (isBoWorkforceTrainingPath(joined)) return handleBoWorkforceTrainingRequest(request, env, joined);
  if (isBoPayrollReviewPath(joined)) return handleBoPayrollReviewRequest(request, env, joined);
  if (isBoPayrollPeriodPath(joined)) return handleBoPayrollPeriodRequest(request, env, joined);
  if (isBoWorkforceDutyExceptionPath(joined)) return handleBoWorkforceDutyExceptionRequest(request, env, joined);
  if (joined === REVIEWED_ENROLLMENT_ACTIVATION_PATH) return handleReviewedEnrollmentActivation(request, env);
  if (joined === "practice/media") return handleBoPracticeMediaUpload(request, env);
  if (joined === "learning/syllabi/media") return handleBoSyllabusMediaRequest(request, env, joined);
  if (joined === "pinoria/ward/set-webm-assets") return handleBoWardSetMediaUpload(request, env);
  if (joined === PINORIA_WORLD_MEDIA_PATH) return handleBoPinoriaWorldMediaUpload(request, env);
  return handleBoWriteRequest(request, env, joined);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoAvatarNicknamePath(joined)) return handleBoAvatarNicknameRequest(request,env,joined);
  if (isBoSubscriptionSpecialtyPath(joined)) return handleBoSubscriptionSpecialtyRequest(request,env,joined);
  if (isBoBillsPath(joined)) return handleBoBillsRequest(request, env, joined);
  if (isBoSelfLoadoutPath(joined)) return handleBoSelfLoadoutRequest(request, env, joined);
  if (isBoSelfItemPath(joined)) return handleBoSelfItemRequest(request, env, joined);
  if (joined.startsWith("views/")) return handleBoPublicViewRequest(request, env, joined);
  if (isBoPayrollPeriodPath(joined)) return handleBoPayrollPeriodRequest(request, env, joined);
  return handleBoWriteRequest(request, env, joined);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoBillsPath(joined)) return handleBoBillsRequest(request, env, joined);
  if (isBoSelfLoadoutPath(joined)) return handleBoSelfLoadoutRequest(request, env, joined);
  if (isBoSelfItemPath(joined)) return handleBoSelfItemRequest(request, env, joined);
  if (joined.startsWith("views/")) return handleBoPublicViewRequest(request, env, joined);
  if (isBoMissionAssignmentWritePath(joined)) return handleBoMissionAssignmentWrite(request, env, joined);
  return handleBoWriteRequest(request, env, joined);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  const joined = path.join("/");
  if (isBoBillsPath(joined)) return handleBoBillsRequest(request, env, joined);
  if (isBoSelfLoadoutPath(joined)) return handleBoSelfLoadoutRequest(request, env, joined);
  if (isBoSelfItemPath(joined)) return handleBoSelfItemRequest(request, env, joined);
  if (joined.startsWith("views/")) return handleBoPublicViewRequest(request, env, joined);
  return handleBoWriteRequest(request, env, joined);
}
