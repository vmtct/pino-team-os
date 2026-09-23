import type { JWTVerifyGetKey } from "jose";
import { BO_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callFounderCore, callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { authenticateTeam, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface FounderFacadeEnv extends TeamAccessEnv {
  PINO_CORE: PinoCoreBinding;
}

export async function handleFounderFacadeRequest(
  request: Request,
  env: FounderFacadeEnv,
  path: string[],
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: unknown = undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (contentType.startsWith("multipart/form-data")) {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "An image file is required" } }, 400);
        body = {
          bytes: await file.arrayBuffer(),
          mimeType: file.type,
          syllabusId: form.get("syllabusId"),
          role: form.get("role"),
          altText: form.get("altText"),
        };
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
      : await callFounderCore(
          env.PINO_CORE,
          coreRequest,
          await authenticateTeam(request.headers, env, surface(request), keyResolver),
        );
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_UNAUTHORIZED", message: error.message } }, error.status);
    console.error("Founder facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

function surface(request: Request): "BO" | "TOS" {
  const host = normalizeHostname(request.headers.get("host") ?? new URL(request.url).hostname);
  return host === BO_HOSTNAME ? "BO" : "TOS";
}

function cookie(headers: Headers, name: string): string {
  return headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

