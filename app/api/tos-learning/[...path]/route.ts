import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callTosLearningCoreWithStaffPin, callTosLearningCoreWithCredential, type TosLearningCoreBinding } from "@/lib/tos-learning-core";
import { staffPinSession } from "@/lib/local-staff-session";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "@/lib/team-auth";
import { tosQueryParamValue } from "@/lib/tos-query-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
type TosLearningEnv = TeamAccessEnv & { PINO_TOS_LEARNING_CORE: TosLearningCoreBinding };

async function handle(request: Request, context: Context) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: TosLearningEnv };
    const { path } = await context.params;
    let body: Record<string, unknown> = {};
    const url = new URL(request.url);
    for (const [key, value] of url.searchParams) if (key !== "t") body[key] = tosQueryParamValue(key, value);
    if (request.method !== "GET" && request.method !== "HEAD") {
      const parsed = await request.json().catch(() => ({}));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = { ...body, ...parsed };
    }
    const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
    const coreRequest = { method: request.method, path: `/${path.join("/")}`, body, ...(idempotencyKey ? { idempotencyKey } : {}) };
    const pinToken = staffPinSession(request);
    const result = pinToken
      ? await callTosLearningCoreWithStaffPin(env.PINO_TOS_LEARNING_CORE, coreRequest, pinToken)
      : await callTosLearningCoreWithCredential(env.PINO_TOS_LEARNING_CORE, coreRequest, await teamCredential(request, env, "TOS"));
    return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store", "x-request-id": result.requestId } });
  } catch (error) {
    if (error instanceof TeamAuthError) return Response.json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, { status: error.status, headers: { "cache-control": "no-store" } });
    console.error("TOS learning facade failure", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;