import type { VerifiedWorkforceIdentity } from "./workforce-auth";

export type TosStagingAuthEnv = {
  PINORIA_TOS_STAGING_BYPASS?: string;
  PINORIA_STAGING_STAFF_EMAIL?: string;
};

export function isTosStagingBypassRequest(request: Request, env: TosStagingAuthEnv) {
  if (env.PINORIA_TOS_STAGING_BYPASS !== "enabled") return false;
  const headerHost = request.headers.get("host")?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  const hostname = headerHost || new URL(request.url).hostname.toLowerCase();
  return hostname.endsWith(".workers.dev");
}

export function stagingWorkforceIdentity(request: Request, env: TosStagingAuthEnv): VerifiedWorkforceIdentity | null {
  if (!isTosStagingBypassRequest(request, env)) return null;
  const email = env.PINORIA_STAGING_STAFF_EMAIL?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return { provider:"cloudflare_access", subject:"pinoria-tos-staging-bypass-v1", email,
    issuer:"https://pinoria-staging.invalid", audience:["pinoria-staging"], expiresAt:4_102_444_800 };
}

export function stagingStaffEmail(request: Request, env: TosStagingAuthEnv) {
  return stagingWorkforceIdentity(request, env)?.email ?? null;
}
