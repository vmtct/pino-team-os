import type { FounderActorContext } from "./founder-auth";

export type FounderStagingAuthEnv = {
  PINORIA_BO_STAGING_BYPASS?: string;
  FOUNDER_EMAIL?: string;
};

export function stagingFounderActor(request: Request, env: FounderStagingAuthEnv): FounderActorContext | null {
  if (env.PINORIA_BO_STAGING_BYPASS !== "enabled") return null;
  const headerHost = request.headers.get("host")?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  const hostname = headerHost || new URL(request.url).hostname.toLowerCase();
  if (!hostname.endsWith(".workers.dev")) return null;
  const email = env.FOUNDER_EMAIL?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return { actorType: "founder", subject: `pinoria-bo-staging:${email}`, email };
}
