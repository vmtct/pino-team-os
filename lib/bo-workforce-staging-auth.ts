import type { VerifiedBoIdentity } from "./bo-auth";

export type BoWorkforceStagingAuthEnv = {
  WORKFORCE_BO_STAGING_BYPASS?: string;
  WORKFORCE_STAGING_BO_EMAIL?: string;
};

export function stagingBoWorkforceIdentity(
  request: Request,
  env: BoWorkforceStagingAuthEnv,
): VerifiedBoIdentity | null {
  if (env.WORKFORCE_BO_STAGING_BYPASS !== "enabled") return null;
  const headerHost = request.headers.get("host")?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  const hostname = headerHost || new URL(request.url).hostname.toLowerCase();
  if (!hostname.endsWith(".workers.dev")) return null;
  const email = env.WORKFORCE_STAGING_BO_EMAIL?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return {
    provider: "cloudflare_access",
    subject: "workforce-bo-staging-probe-v1",
    email,
    issuer: "https://workforce-staging.invalid",
    audience: ["workforce-bo-staging"],
    expiresAt: 4_102_444_800,
  };
}
