import type { VerifiedBoIdentity } from "./bo-auth";

export type BoOpenStudioStagingAuthEnv = {
  OPEN_STUDIO_BO_STAGING_BYPASS?: string;
  OPEN_STUDIO_STAGING_BO_EMAIL?: string;
};

export function stagingBoOpenStudioIdentity(
  request: Request,
  env: BoOpenStudioStagingAuthEnv,
): VerifiedBoIdentity | null {
  if (env.OPEN_STUDIO_BO_STAGING_BYPASS !== "enabled") return null;
  const headerHost = request.headers.get("host")?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  const hostname = headerHost || new URL(request.url).hostname.toLowerCase();
  if (!hostname.endsWith(".workers.dev")) return null;
  const email = env.OPEN_STUDIO_STAGING_BO_EMAIL?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return {
    provider: "cloudflare_access",
    subject: "open-studio-control-loop-staging-probe-v1",
    email,
    issuer: "https://open-studio-control-loop-staging.invalid",
    audience: ["open-studio-control-loop-staging"],
    expiresAt: 4_102_444_800,
  };
}
