import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "@/lib/founder-core";
import { LocalStaffSessionError, staffPasswordSession } from "@/lib/local-staff-session";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
type FounderEnv = { PINO_CORE: PinoCoreBinding };

async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: FounderEnv };
    const token = staffPasswordSession(request);
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
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE, {
      method: request.method,
      path: `/${path.join("/")}`,
      body,
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
    }, token);    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof LocalStaffSessionError) return json({ error: { code: "IDENTITY_UNAUTHORIZED", message: error.message } }, 401);
    console.error("Founder facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;