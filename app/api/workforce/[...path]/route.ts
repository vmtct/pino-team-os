import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callWorkforceCoreWithStaffPin, type WorkforceCoreBinding } from "@/lib/workforce-core";
import { missingStaffSessionResponse, readStaffSessionToken } from "@/lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };
type WorkforceEnv = { PINO_WORKFORCE_CORE: WorkforceCoreBinding };

async function handle(request: Request, context: Context) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: WorkforceEnv };
    const token = readStaffSessionToken(request);
    if (!token) return missingStaffSessionResponse();
    const { path } = await context.params;
    let body: Record<string, unknown> = {};
    const url = new URL(request.url);
    for (const [key, value] of url.searchParams) {
      if (key !== "t" && key !== "mobile" && key !== "username") body[key] = value;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      const parsed = await request.json().catch(() => ({}));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = { ...body, ...parsed };
    }
    const coreRequest = { method: request.method, path: `/${path.join("/")}`, body };
    const result = await callWorkforceCoreWithStaffPin(env.PINO_WORKFORCE_CORE, coreRequest, token);
    return Response.json(result.body, {
      status: result.status,
      headers: { "cache-control": "no-store", "x-request-id": result.requestId },
    });
  } catch (error) {
    console.error("Workforce facade failure", error instanceof Error ? error.message : "unknown");
    return Response.json(
      { error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
