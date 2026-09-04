import { callCenterNetworkHeartbeat, type WorkforceNetworkPresenceCoreBinding } from "./center-network-core";

export interface CenterNetworkIngressEnv {
  WORKFORCE_CENTER_NETWORK_STAGING_INGRESS?: string;
  PINO_WORKFORCE_NETWORK_CORE?: WorkforceNetworkPresenceCoreBinding;
}

export async function handleCenterNetworkIngress(request: Request, env: CenterNetworkIngressEnv) {
  const url = new URL(request.url);
  if (env.WORKFORCE_CENTER_NETWORK_STAGING_INGRESS !== "enabled" || !url.hostname.endsWith(".workers.dev")) {
    return response(404, "NOT_FOUND", "Not found");
  }
  if (!env.PINO_WORKFORCE_NETWORK_CORE) return response(503, "UNAVAILABLE", "Heartbeat unavailable");

  const sourceIp = request.headers.get("cf-connecting-ip")?.trim();
  const token = bearer(request.headers.get("authorization"));
  if (!sourceIp || !token) return response(403, "FORBIDDEN", "Heartbeat rejected");

  let centerId = "";
  try {
    const body = await request.json() as { centerId?: unknown };
    centerId = typeof body.centerId === "string" ? body.centerId.trim() : "";
  } catch {
    return response(400, "INVALID_INPUT", "Invalid heartbeat");
  }
  if (!centerId) return response(400, "INVALID_INPUT", "Invalid heartbeat");

  try {
    const data = await callCenterNetworkHeartbeat(env.PINO_WORKFORCE_NETWORK_CORE, {
      centerId,
      serverObservedIp: sourceIp,
      agentToken: token,
    });
    return Response.json({ data }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    return response(403, "FORBIDDEN", "Heartbeat rejected");
  }
}

function bearer(value: string | null) {
  return /^Bearer\s+(.+)$/i.exec(value?.trim() ?? "")?.[1]?.trim() ?? "";
}

function response(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}
