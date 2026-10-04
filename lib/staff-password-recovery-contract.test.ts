import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path: string) { return readFile(path, "utf8"); }

test("TOS exposes forgot-password UX while BO remains outside the recovery surface", async () => {
  const [login, forgot, reset, host] = await Promise.all([
    read("app/staff-login/page.tsx"),
    read("app/staff-password/forgot/page.tsx"),
    read("app/staff-password/reset/page.tsx"),
    read("lib/host-boundary.ts"),
  ]);
  assert.match(login, /tos\.pinohouse\.art/);
  assert.match(login, /\/staff-password\/forgot/);
  assert.match(forgot, /\/api\/staff-auth\/forgot-password/);
  assert.match(reset, /\/api\/staff-auth\/reset-password/);
  assert.match(reset, /window\.location\.hash/);
  assert.match(reset, /history\.replaceState/);
  assert.doesNotMatch(reset, /location\.search|searchParams\.get\(["']token/);
  assert.doesNotMatch(host, /isBoLocalAuthPath[\s\S]{0,500}staff-password\/forgot/);
});

test("Team runtime declares Cloudflare email binding and sender config without handler hard-coding", async () => {
  const [production, staging, handler, binding] = await Promise.all([
    read("wrangler.jsonc"),
    read("wrangler.staging.jsonc"),
    read("lib/staff-password-recovery-handler.ts"),
    read("lib/staff-password-core.ts"),
  ]);
  for (const config of [production, staging]) {
    assert.match(config, /"send_email"\s*:\s*\[\{\s*"name"\s*:\s*"PINO_STAFF_PASSWORD_EMAIL"/);
    assert.match(config, /"STAFF_PASSWORD_RESET_FROM_EMAIL"\s*:\s*"[^"\s]+@pinohouse\.art"/);
  }
  assert.match(handler, /STAFF_PASSWORD_RESET_FROM_EMAIL/);
  assert.match(handler, /https:\/\/\$\{TOS_HOSTNAME\}\/staff-password\/reset#token=/);
  assert.doesNotMatch(handler, /from:\s*["'][^"']+@pinohouse\.art/);
  assert.match(binding, /requestPasswordReset/);
  assert.match(binding, /cancelPasswordReset/);
  assert.match(binding, /resetPassword/);
});
