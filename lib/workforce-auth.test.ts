import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { authenticateWorkforce, WorkforceAuthError } from "./workforce-auth";

const domain = "team.cloudflareaccess.com";
const audience = "tos-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "workforce";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown> = {}, tokenAudience = audience, expiration = "5m") => new SignJWT({ email: "staff@example.com", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "workforce" })
    .setIssuer(`https://${domain}`)
    .setAudience(tokenAudience)
    .setSubject("verified-staff-subject")
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(privateKey);
  return { resolver, sign };
}

test("Workforce rejects a missing Access assertion", async () => {
  await assert.rejects(authenticateWorkforce(new Headers(), { teamDomain: domain, audience }), WorkforceAuthError);
});

test("Workforce rejects invalid audience and expired assertions", async () => {
  const f = await fixture();
  for (const token of [await f.sign({}, "wrong"), await f.sign({}, audience, "-1s")]) {
    await assert.rejects(authenticateWorkforce(new Headers({ "cf-access-jwt-assertion": token }), { teamDomain: domain, audience }, f.resolver), WorkforceAuthError);
  }
});

test("Workforce accepts any cryptographically verified Staff identity without a Founder allowlist", async () => {
  const f = await fixture();
  const token = await f.sign({ email: "ordinary.staff@example.com" });
  const identity = await authenticateWorkforce(new Headers({ "cf-access-jwt-assertion": token }), { teamDomain: domain, audience }, f.resolver);
  assert.deepEqual({ subject: identity.subject, email: identity.email }, { subject: "verified-staff-subject", email: "ordinary.staff@example.com" });
});
