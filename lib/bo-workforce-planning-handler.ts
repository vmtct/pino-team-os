import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError, type VerifiedBoIdentity } from "./bo-auth";

export interface WorkforcePlanningRequest {
  method: string;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}

export interface WorkforcePlanningResponse {
  status: number;
  body: unknown;
  requestId: string;
}

export interface WorkforcePlanningCoreBinding {
  executePlanning(request: WorkforcePlanningRequest, identity: VerifiedBoIdentity): Promise<WorkforcePlanningResponse>;
}

export interface BoWorkforcePlanningEnv {
  PINO_WORKFORCE_CORE: WorkforcePlanningCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

const PREFIX = "workforce/planning/";
const GET_WEEKLY = "workforce/planning/weekly";
const POST_ASSIGNMENT = "workforce/planning/assignment";
const POST_CANCEL = "workforce/planning/assignment/cancel";

export async function handleBoWorkforcePlanningRequest(
  request: Request,
  env: BoWorkforcePlanningEnv,
  path: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (!path.startsWith(PREFIX)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO workforce planning operation not found" } }, 404);
    const method = request.method.toUpperCase();
    if (!((method === "GET" && path === GET_WEEKLY) || (method === "POST" && (path === POST_ASSIGNMENT || path === POST_CANCEL)))) {
      return json({ error: { code: method === "GET" || method === "POST" ? "PLATFORM_NOT_FOUND" : "PLATFORM_METHOD_NOT_ALLOWED", message: method === "GET" || method === "POST" ? "BO workforce planning operation not found" : "Method not allowed" } }, method === "GET" || method === "POST" ? 404 : 405);
    }

    const identity = await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );

    let body: Record<string, unknown>;
    let idempotencyKey: string | undefined;
    if (method === "GET") {
      const url = new URL(request.url);
      body = {
        centerId: url.searchParams.get("centerId"),
        termWeekId: url.searchParams.get("termWeekId"),
      };
    } else {
      idempotencyKey = request.headers.get("idempotency-key")?.trim();
      if (!idempotencyKey) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);
      const parsed = await request.json().catch(() => null);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A JSON request body is required" } }, 400);
      }
      body = parsed as Record<string, unknown>;
    }

    const corePath = path.slice(PREFIX.length);
    const result = await env.PINO_WORKFORCE_CORE.executePlanning(
      { method, path: corePath, body, ...(idempotencyKey ? { idempotencyKey } : {}) },
      identity,
    );
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO workforce planning facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

export function isBoWorkforcePlanningPath(path: string): boolean {
  return path.startsWith(PREFIX);
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
