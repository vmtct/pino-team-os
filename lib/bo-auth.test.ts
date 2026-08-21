import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { authenticateWorkforce, WorkforceAuthError } from "./workforce-auth";

const domain = "team.cloudflareaccess.com";
const boAudience = "bo-audience";
const tosAudience = "tos-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const sign = (
    audience = boAudience,
    claims: Record<string, unknown> = { email: "bo.user@example.com" },
    expiration = "5m",
  ) => new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "bo" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("verified-bo-subject")
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(privateKey);
  return { resolver, sign };
}

test("BO rejects missing assertions and missing BO configuration", async () => {
  await assert.rejects(authenticateBo(new Headers(), { teamDomain: domain, audience: boAudience }), BoAuthError);
  const f = await fixture();
  const token = await f.sign();
  await assert.rejects(
    authenticateBo(new Headers({ "cf-access-jwt-assertion": token }), { teamDomain: domain, audience: "" }, f.resolver),
    (error: unknown) => error instanceof BoAuthError && error.status === 503,
  );
});

test("BO rejects invalid, expired, TOS-audience, and incomplete assertions", async () => {
  const f = await fixture();
  const tokens = [
    "invalid",
    await f.sign(boAudience, { email: "bo.user@example.com" }, "-1s"),
    await f.sign(tosAudience),
    await f.sign(boAudience, {}),
  ];
  for (const token of tokens) {
    await assert.rejects(
      authenticateBo(new Headers({ "cf-access-jwt-assertion": token }), { teamDomain: domain, audience: boAudience }, f.resolver),
      (error: unknown) => error instanceof BoAuthError && error.status === 401,
    );
  }
});

test("BO accepts a valid BO-audience identity without local authorization claims", async () => {
  const f = await fixture();
  const token = await f.sign(boAudience, { email: "  BO.User@Example.com " });
  const identity = await authenticateBo(
    new Headers({ "cf-access-jwt-assertion": token }),
    { teamDomain: domain, audience: boAudience },
    f.resolver,
  );
  assert.deepEqual(
    { subject: identity.subject, email: identity.email, audience: identity.audience },
    { subject: "verified-bo-subject", email: "bo.user@example.com", audience: [boAudience] },
  );
});

test("BO and TOS audiences are mutually rejected by the other verifier", async () => {
  const f = await fixture();
  const [boToken, tosToken] = await Promise.all([f.sign(boAudience), f.sign(tosAudience)]);
  await assert.rejects(
    authenticateBo(new Headers({ "cf-access-jwt-assertion": tosToken }), { teamDomain: domain, audience: boAudience }, f.resolver),
    BoAuthError,
  );
  await assert.rejects(
    authenticateWorkforce(new Headers({ "cf-access-jwt-assertion": boToken }), { teamDomain: domain, audience: tosAudience }, f.resolver),
    WorkforceAuthError,
  );
});
