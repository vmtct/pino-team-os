import { jwtVerify } from "jose/jwt/verify";
import { createRemoteJWKSet } from "jose";
import type { JWTPayload } from "jose";

export type PinoIdentity = {
  userId: string;
  email: string;
  name: string;
  claims: JWTPayload;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function issuer(): string {
  const domain = requiredEnv("CF_ACCESS_TEAM_DOMAIN").replace(/\/$/, "");
  return domain.startsWith("https://") ? domain : `https://${domain}`;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function accessJwks() {
  jwks ??= createRemoteJWKSet(new URL(`${issuer()}/cdn-cgi/access/certs`));
  return jwks;
}

export async function verifyAccessJwt(token: string): Promise<PinoIdentity> {
  const { payload } = await jwtVerify(token, accessJwks(), {
    issuer: issuer(),
    audience: requiredEnv("CF_ACCESS_AUDIENCE"),
  });

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  const name = typeof payload.name === "string" ? payload.name : email;

  if (!userId && !email) {
    throw new Error("Cloudflare Access token has no usable identity");
  }

  return { userId, email, name, claims: payload };
}

export function accessTokenFromRequest(request: Request): string | null {
  return request.headers.get("CF-Access-JWT-Assertion");
}

export async function authenticateRequest(request: Request): Promise<PinoIdentity> {
  const token = accessTokenFromRequest(request);
  if (!token) throw new Error("Missing Cloudflare Access JWT");
  return verifyAccessJwt(token);
}
