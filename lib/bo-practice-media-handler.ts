import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";

export interface BoPracticeMediaEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

const PRACTICE_MEDIA_PATH = "practice/media";

export async function handleBoPracticeMediaUpload(
  request: Request,
  env: BoPracticeMediaEnv,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    }

    const identity = await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A multipart form body is required" } }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A non-empty file is required" } }, 400);
    }

    const bytes = await file.arrayBuffer();
    const result = await callBoAccessCore(env.PINO_BO_CORE, {
      method: "POST",
      path: PRACTICE_MEDIA_PATH,
      body: {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        bytes,
      },
      idempotencyKey,
    }, identity);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO Practice media facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
