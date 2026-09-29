import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manager = fs.readFileSync("app/bo/staff/StaffManagementView.tsx", "utf8");
const enter = fs.readFileSync("app/api/support-session/enter/route.ts", "utf8");
const banner = fs.readFileSync("app/components/tos-shell/SupportSessionBanner.tsx", "utf8");

test("support capability crosses BO to TOS by POST body, never URL token", () => {
  assert.match(manager, /form\.method\s*=\s*"POST"/);
  assert.match(manager, /https:\/\/tos\.pinohouse\.art\/api\/support-session\/enter/);
  assert.match(manager, /token\.type\s*=\s*"hidden"/);
  assert.match(manager, /token\.name\s*=\s*"token"/);
  assert.doesNotMatch(manager, /[?&]token=/);
});

test("TOS support cookie is hardened, host-only, and replaces ordinary TOS credentials", () => {
  assert.match(enter, /pino_support_session=\$\{token\}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=\$\{seconds\}/);
  assert.doesNotMatch(enter, /Domain=/);
  assert.match(enter, /pino_staff_password_session=; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
  assert.match(enter, /pino_staff_session=; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
});

test("active support session is visibly identified and has an explicit exit", () => {
  assert.match(banner, /VIEW AS/);
  assert.match(banner, /ACT AS/);
  assert.match(banner, /state\.subjectEmail/);
  assert.match(banner, /state\.reason/);
  assert.match(banner, /formatExpiry\(state\.expiresAt\)/);
  assert.match(banner, /Thoát debug/);
  assert.match(banner, /\/api\/support-session\/logout/);
});
