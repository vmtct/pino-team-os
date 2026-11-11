// PAP-1838 / PNR-IDENTITY — no-network frontend input, redirect and privacy tests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  safePinerReturnTo, normalizePinerPhone, maskPinerPhone,
  challengeDeadline, pinerAuthError, OTP_LIFETIME_MS, RESEND_COOLDOWN_MS,
} from "../lib/piner-login-policy.ts";

test("PAP-1838 safe same-origin Piner returnTo allows approved internal routes", () => {
  assert.equal(safePinerReturnTo("/piner"), "/piner");
  assert.equal(safePinerReturnTo("/piner/public/post/p3"), "/piner/public/post/p3");
  assert.equal(safePinerReturnTo("/piner/public/profile/mai?post=p5#comments"), "/piner/public/profile/mai?post=p5#comments");
  assert.equal(safePinerReturnTo("/piner/mytime/community"), "/piner/mytime/community");
});
test("PAP-1838 returnTo denies protocol, open redirect, control chars, login loops and path traversal", () => {
  for (const value of [
    undefined, null, "", "https://evil.test/piner", "//evil.test/piner",
    "/piner.evil.test", "/piner\\evil.test", "/piner/%2F%2Fevil.test",
    "/piner/../admin", "/piner/%5c%5cevil.test", "/piner/public/login?returnTo=/piner",
    "/Piner", "/piner/\naccess", "/piner/" + "x".repeat(600),
  ]) assert.equal(safePinerReturnTo(value), "/piner/public");
});
test("PAP-1838 accepts VN mobile only, normalizes without recording PII", () => {
  assert.equal(normalizePinerPhone("090 123 4567"), "+84901234567");
  assert.equal(normalizePinerPhone("+84 90-123-4567"), "+84901234567");
  assert.equal(normalizePinerPhone("84901234567"), "+84901234567");
  assert.equal(normalizePinerPhone("083.123.4567"), "+84831234567");
  assert.equal(normalizePinerPhone("1234567890"), null);
  assert.equal(normalizePinerPhone("0123456789"), null);
  assert.equal(normalizePinerPhone("090123456"), null);
  assert.equal(normalizePinerPhone("+84901234567;admin=true"), null);
  assert.equal(maskPinerPhone("+84901234567"), "+84 ••• ••• 567");
});
test("PAP-1838 challenge has 5-minute server deadline and 60s resend policy", () => {
  const now = Date.parse("2026-11-11T05:00:00Z");
  assert.equal(OTP_LIFETIME_MS, 300_000);
  assert.equal(RESEND_COOLDOWN_MS, 60_000);
  assert.equal(challengeDeadline(new Date(now + 300_000).toISOString(), now), now + 300_000);
  assert.equal(challengeDeadline(new Date(now - 1).toISOString(), now), null);
  assert.equal(challengeDeadline(new Date(now + 60 * 60_000).toISOString(), now), null);
  assert.equal(challengeDeadline("fake", now), null);
});
test("PAP-1838 errors remain neutral and no phone enumeration", () => {
  assert.match(pinerAuthError(503, "request"), /Zalo/);
  assert.match(pinerAuthError(429, "request"), /quá nhiều/);
  assert.match(pinerAuthError(401, "verify"), /chưa đúng|hết hạn/);
  assert.equal(pinerAuthError(404, "request"), pinerAuthError(503, "request"));
});
test("PAP-1838 BFF-only source has no mock auth success, password or client-side bearer persistence", () => {
  const component = readFileSync("app/piner/public/login/PinerLoginForm.tsx", "utf8");
  const page = readFileSync("app/piner/public/login/page.tsx", "utf8");
  assert.match(component, /\/api\/piner\/auth\/session/);
  assert.match(component, /otp\/verify/);
  assert.match(component, /otp\/request/);
  assert.match(component, /router\.replace\(destination\)/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|document\.cookie|Math\.random\(\)/);
  assert.doesNotMatch(page, /type="password"|mock"/);
});
