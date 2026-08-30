import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface VerifiedGoogleIdentity {
  provider: "google";
  subject: string;
  email: string;
  issuer: string;
  audience: string[];
  expiresAt: number;
}

export class GoogleAuthError extends Error {
  constructor(readonly status: 401 | 503, message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export async function authenticateGoogleCredential(
  credential: string,
  clientId: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<VerifiedGoogleIdentity> {
  if (!clientId) throw new GoogleAuthError(503, "Google SSO is not configured");
  if (!credential) throw new GoogleAuthError(401, "Google authentication is required");
  try {
    const { payload } = await jwtVerify(credential, keyResolver ?? GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });
    if (
      typeof payload.sub !== "string" || !payload.sub ||
      typeof payload.email !== "string" || !payload.email ||
      payload.email_verified !== true ||
      typeof payload.exp !== "number"
    ) throw new Error("claims");
    const aud = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === "string" ? [payload.aud] : [];
    return {
      provider: "google",
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      issuer: typeof payload.iss === "string" ? payload.iss : "https://accounts.google.com",
      audience: aud,
      expiresAt: payload.exp,
    };
  } catch {
    throw new GoogleAuthError(401, "Google identity token is invalid");
  }
}
