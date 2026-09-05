import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callFounderCore, callFounderCoreWithStaffPassword, type PinoCoreBinding } from "@/lib/founder-core";
import { authenticateCloudflareAccess, TeamAuthError } from "@/lib/team-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
type FounderEnv = { PINO_CORE: PinoCoreBinding; CF_ACCESS_TEAM_DOMAIN?:string; CF_ACCESS_AUDIENCE?:string };

async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: FounderEnv };
    const { path } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    let body: unknown = undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (contentType.startsWith("multipart/form-data")) {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "An image file is required" } }, 400);
        body = { bytes: await file.arrayBuffer(), mimeType: file.type, syllabusId: form.get("syllabusId"), role: form.get("role"), altText: form.get("altText") };
      } else body = contentType.includes("application/json") ? await request.json() : undefined;
    }
    const coreRequest = {
      method: request.method,
      path: `/${path.join("/")}`,
      body,
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
    };
    const passwordToken = cookie(request.headers, "pino_staff_password_session");
    const result = passwordToken
      ? await callFounderCoreWithStaffPassword(env.PINO_CORE, coreRequest, passwordToken)
      : await callFounderCore(env.PINO_CORE, coreRequest, await founderIdentity(request, env));
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_UNAUTHORIZED", message: error.message } }, error.status);
    console.error("Founder facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

async function founderIdentity(request:Request, env:FounderEnv){
  return authenticateCloudflareAccess(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_AUDIENCE});
}
function cookie(headers:Headers,name:string){return headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)??"";}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;