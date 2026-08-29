import { authenticateWorkforce } from "./workforce-auth";

export type PinoriaTvAuthEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_TOS_AUD?: string;
  PINORIA_TV_STAGING_BYPASS?: string;
};

export function isPinoriaTvStagingBypass(url: string, flag?: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  return flag === "enabled" && hostname.endsWith(".workers.dev");
}

export async function authenticatePinoriaTvRequest(request: Request, env: PinoriaTvAuthEnv) {
  if (isPinoriaTvStagingBypass(request.url, env.PINORIA_TV_STAGING_BYPASS)) return;

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_TOS_AUD?.trim();
  if (!teamDomain || !audience) {
    throw new Error("PINORIA_TV_ACCESS_CONFIG_UNAVAILABLE");
  }
  await authenticateWorkforce(request.headers, { teamDomain, audience });
}
