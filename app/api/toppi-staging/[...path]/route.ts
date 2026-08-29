import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { BoAccessCoreBinding, BoAccessRequest } from "@/lib/bo-core";
import type { VerifiedBoIdentity } from "@/lib/bo-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = {
  PINO_BO_CORE: BoAccessCoreBinding;
  TOPPI_STAGING_MODE: string;
  TOPPI_STAGING_CENTER_ID: string;
};
type RouteContext = { params: Promise<{ path: string[] }> };

const identity: VerifiedBoIdentity = {
  provider: "cloudflare_access",
  subject: "toppi-staging-operator",
  email: "toppi.staging@pino.invalid",
  issuer: "https://pino.cloudflareaccess.com",
  audience: ["bo"],
  expiresAt: 4_102_444_800,
};

export async function GET(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return forward(request, context);
}
async function forward(request: Request, context: RouteContext) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
  if (env.TOPPI_STAGING_MODE !== "canonical-synthetic" || !env.PINO_BO_CORE) {
    return Response.json({ error: { message: "Toppi canonical staging is unavailable" } }, { status: 503 });
  }
  const { path } = await context.params;
  const url = new URL(request.url);
  const suffix = url.searchParams.toString();
  const corePath = `toppi/${path.join("/")}${suffix ? `?${suffix}` : ""}`;
  const coreRequest: BoAccessRequest = { method: request.method, path: corePath };
  if (request.method === "POST") {
    coreRequest.body = await request.json().catch(() => ({}));
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (idempotencyKey) coreRequest.idempotencyKey = idempotencyKey;
  }
  const result = await env.PINO_BO_CORE.execute(coreRequest, identity);
  return Response.json(result.body, {
    status: result.status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": result.requestId,
      "x-toppi-staging": "canonical-synthetic",
    },
  });
}
