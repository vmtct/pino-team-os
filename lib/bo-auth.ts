import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface VerifiedBoIdentity {
  provider: "cloudflare_access";
  subject: string;
  email: string;
  issuer: string;
  audience: string[];
  expiresAt: number;
}

export class BoAuthError extends Error {
  constructor(readonly status: 401 | 503, message: string) {
    super(message);
    this.name = "BoAuthError";
  }
}

export async function authenticateBo(
  headers: Headers,
  config: { teamDomain: string; audience: string },
  keyResolver?: JWTVerifyGetKey,
): Promise<VerifiedBoIdentity> {
  const token = headers.get("cf-access-jwt-assertion");
  if (!token) throw new BoAuthError(401, "Cloudflare Access authentication is required");

  const domain = config.teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  const audience = config.audience.trim();
  if (!domain || !audience) throw new BoAuthError(503, "BO authentication is not configured");

  try {
    const issuer = `https://${domain}`;
    const { payload } = await jwtVerify(
      token,
      keyResolver ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
      { issuer, audience },
    );
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (typeof payload.sub !== "string" || !payload.sub.trim() || !email || typeof payload.exp !== "number") {
      throw new Error("Required Cloudflare Access claims are missing");
    }
    const tokenAudience = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === "string" ? [payload.aud] : [];
    return {
      provider: "cloudflare_access",
      subject: payload.sub,
      email,
      issuer,
      audience: tokenAudience,
      expiresAt: payload.exp,
    };
  } catch {
    throw new BoAuthError(401, "Cloudflare Access token is invalid");
  }
}
