import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function classify(location: string, host = "tos.pinohouse.art") {
  return execFileSync(process.execPath, ["scripts/team-release-auth-boundary.mjs", location, host], {
    encoding: "utf8",
  }).trim();
}

test("Team release redirect classifier accepts only exact local Staff login or Cloudflare Access authority", () => {
  assert.equal(classify("/staff-login"), "LOCAL");
  assert.equal(classify("https://tos.pinohouse.art/staff-login"), "LOCAL");
  assert.equal(classify("https://pino.cloudflareaccess.com/cdn-cgi/access/login/tos.pinohouse.art"), "ACCESS");
  assert.equal(classify("https://cloudflareaccess.com/cdn-cgi/access/login/tos.pinohouse.art"), "ACCESS");
});

test("Team release redirect classifier rejects deceptive Cloudflare Access lookalikes", () => {
  for (const location of [
    "https://cloudflareaccess.com.evil.example/",
    "https://pino.cloudflareaccess.com.evil.example/",
    "https://other.example/?next=cloudflareaccess.com",
    "/public?cloudflareaccess.com",
    "http://pino.cloudflareaccess.com/cdn-cgi/access/login/tos.pinohouse.art",
  ]) {
    assert.equal(classify(location), "INVALID", location);
  }
});

test("Team release redirect classifier rejects non-exact local login destinations", () => {
  for (const location of [
    "https://evil.example/staff-login",
    "https://tos.pinohouse.art.evil.example/staff-login",
    "https://tos.pinohouse.art:444/staff-login",
    "https://tos.pinohouse.art/staff-login?next=/bo",
    "https://tos.pinohouse.art/staff-login#fragment",
    "/staff-login?next=/bo",
  ]) {
    assert.equal(classify(location), "INVALID", location);
  }
});
