import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("wrangler prepares only canonical TOS and BO domains plus the private BO binding", async () => {
  const source = await readFile("wrangler.jsonc", "utf8");
  assert.match(source, /"PINO_BO_CORE"[^\n]+"pino-core"[^\n]+"BoAccessControlPlane"/);
  assert.match(source, /"tos\.pinohouse\.art"/);
  assert.match(source, /"bo\.pinohouse\.art"/);
  assert.doesNotMatch(source, /"team\.pinohouse\.art"/);
  assert.doesNotMatch(source, /"CF_ACCESS_BO_AUD"\s*:/);
});

test("BO facade uses only BO auth and PINO_BO_CORE", async () => {
  const sources = await Promise.all([
    readFile("app/api/bo/context/route.ts", "utf8"),
    readFile("lib/bo-context-handler.ts", "utf8"),
    readFile("lib/bo-core.ts", "utf8"),
  ]).then((items) => items.join("\n"));
  assert.match(sources, /PINO_BO_CORE/);
  assert.match(sources, /CF_ACCESS_BO_AUD/);
  assert.doesNotMatch(sources, /FOUNDER_EMAIL/);
  assert.doesNotMatch(sources, /FounderControlPlane|PINO_WORKFORCE_CORE|targetStaffMemberId|userId=|staffMemberId=/);
});

test("BO shell remains foundation-only and does not import Founder or Workforce features", async () => {
  const sources = await Promise.all([
    readFile("app/bo/layout.tsx", "utf8"),
    readFile("app/bo/page.tsx", "utf8"),
    readFile("app/bo/BoContextCard.tsx", "utf8"),
  ]).then((items) => items.join("\n"));
  assert.match(sources, /BoShell/);
  assert.match(sources, /\/api\/bo\/context/);
  assert.doesNotMatch(sources, /founderApi|WorkforceWorkspace|\/founder|\/api\/workforce/);
});
