import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface VerifiedTeamIdentity {
  provider: "cloudflare_access";
  subject: string;
  email: string;
  issuer: string;
  audience: string[];
  expiresAt: number;
}

export interface TeamAccessEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_TOS_AUD?: string;
  CF_ACCESS_BO_AUD?: string;
}

export type TeamCredential =
  | { kind: "password"; token: string }
  | { kind: "cloudflare"; identity: VerifiedTeamIdentity };

export class TeamAuthError extends Error {
  constructor(readonly status: 401 | 503, message: string) {
    super(message);
    this.name = "TeamAuthError";
  }
}

export async function teamCredential(
  request: Request,
  env: TeamAccessEnv,
  surface: "TOS" | "BO",
  keyResolver?: JWTVerifyGetKey,
): Promise<TeamCredential> {
  return teamCredentialFromHeaders(request.headers, env, surface, keyResolver);
}

export async function teamCredentialFromHeaders(
  headers: Headers,
  env: TeamAccessEnv,
  surface: "TOS" | "BO",
  keyResolver?: JWTVerifyGetKey,
): Promise<TeamCredential> {
  const password = cookie(headers, "pino_staff_password_session");
  if (password) return { kind: "password", token: password };
  return { kind: "cloudflare", identity: await authenticateTeam(headers, env, surface, keyResolver) };
}

export async function authenticateTeam(
  headers: Headers,
  env: TeamAccessEnv,
  surface: "TOS" | "BO",
  keyResolver?: JWTVerifyGetKey,
): Promise<VerifiedTeamIdentity> {
  const audience = (surface === "BO" ? env.CF_ACCESS_BO_AUD : env.CF_ACCESS_TOS_AUD)?.trim() ?? "";
  return authenticateCloudflareAccess(headers, { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience }, keyResolver);
}

export async function authenticateCloudflareAccess(
  headers: Headers,
  config: { teamDomain?: string; audience?: string },
  keyResolver?: JWTVerifyGetKey,
): Promise<VerifiedTeamIdentity> {
  const token = headers.get("cf-access-jwt-assertion");
  if (!token) throw new TeamAuthError(401, "Staff authentication is required");
  const domain = (config.teamDomain ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  const audience = (config.audience ?? "").trim();
  if (!domain || !audience) throw new TeamAuthError(503, "Cloudflare Access compatibility authentication is not configured");
  try {
    const issuer = `https://${domain}`;
    const { payload } = await jwtVerify(
      token,
      keyResolver ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
      { issuer, audience },
    );
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (typeof payload.sub !== "string" || !payload.sub.trim() || !email || typeof payload.exp !== "number") throw new Error("claims");
    const tokenAudience = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === "string" ? [payload.aud] : [];
    return { provider: "cloudflare_access", subject: payload.sub, email, issuer, audience: tokenAudience, expiresAt: payload.exp };
  } catch {
    throw new TeamAuthError(401, "Cloudflare Access token is invalid");
  }
}

function cookie(headers: Headers, name: string): string {
  return headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
