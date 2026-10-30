import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/bo/page.tsx", "utf8");
const runtime = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
const parent = readFileSync("app/bo/parents/ParentTdd.tsx", "utf8");

test("PAP-1075: pilot only on explicit Parent module and exact BO Staging host", () => {
  assert.match(page, /query\.module === "parents" && query\.pilot === "tdd"/);
  assert.match(page, /\(await headers\(\)\)\.get\("host"\)\?\.split\(":"\)\[0\] === "bo\.staging\.pinohouse\.art"/);
  assert.match(page, /parentTddPilot=\{parentTddPilot\}/);
  assert.doesNotMatch(page, /redirect\([^\n]*pilot/);
});
test("PAP-1075: default Parents renderer remains intact and pilot requires authenticated BO host shell", () => {
  assert.match(runtime, /return currentUser/);
  assert.match(runtime, /moduleKey === "parents" && parentTddPilot \? <ParentTdd \/>/);
  assert.match(runtime, /content=\{moduleKey === "subscriptions"/);
  assert.match(runtime, /: undefined\} \/>/);
  assert.match(parent, /createBoTddAdapter/);
  assert.match(parent, /loadAuthorizedDirectoryCenters/);
  assert.match(parent, /<SurfaceWorkspace adapter=\{ready\.adapter\}/);
});
