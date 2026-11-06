import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boParentTddPilotAllowed } from "./bo-parent-tdd-preview";

const staging = { APP_ENV: "staging", BO_UI_ONLY: "enabled" };
test("PAP-1075: preview only on exact BO Staging host with explicit option", () => {
  assert.equal(boParentTddPilotAllowed(staging, "bo.staging.pinohouse.art", "parents", "tdd"), true);
  for (const host of [
    "bo.pinohouse.art", "ho.staging.pinohouse.art", "tos.staging.pinohouse.art",
    "bo.staging.pinohouse.art.attacker.test", "localhost:3000", "pino-team-os.minhtri-van42.workers.dev",
  ]) assert.equal(boParentTddPilotAllowed(staging, host, "parents", "tdd"), false, host);
  for (const env of [
    { APP_ENV: "production", BO_UI_ONLY: "enabled" },
    { APP_ENV: "staging", BO_UI_ONLY: undefined },
    { APP_ENV: "development", BO_UI_ONLY: "enabled" },
    {},
  ]) assert.equal(boParentTddPilotAllowed(env, "bo.staging.pinohouse.art", "parents", "tdd"), false);
  for (const query of [undefined, null, "", "0", "true", ["1", "1"]])
    assert.equal(boParentTddPilotAllowed(staging, "bo.staging.pinohouse.art", "parents", query), false);
  assert.equal(boParentTddPilotAllowed(staging, "bo.staging.pinohouse.art", "students", "tdd"), false);
  assert.equal(boParentTddPilotAllowed(staging, "bo.staging.pinohouse.art", "subscriptions", "tdd"), false);
});
test("PAP-1543 / PAP-1316: canonical BO Parents never renders the unscoped directory", () => {
  const page = readFileSync("app/bo/page.tsx", "utf8");
  const runtime = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  const provider = readFileSync("app/bo/parents/provider.ts", "utf8");
  const tdd = readFileSync("app/bo/parents/ParentTdd.tsx", "utf8");

  // Normal /bo?module=parents is now the exact same Center-bound reader as
  // the former pilot. A query flag must not decide whether identity is scoped.
  assert.match(page, /<BoRuntimeEntry moduleKey=/);
  assert.doesNotMatch(page, /parentTddPilot|boParentTddPilotAllowed/);
  assert.match(runtime, /if \(moduleKey === "parents"\) return <BoRegistrationWorkspace currentUser=\{currentUser\}/);
  assert.match(runtime, /source=\{unifiedBoWorkspaceSource\} moduleKey="parents" options=\{options\}/);
  assert.match(runtime, /content=\{<ParentTdd \/>\} \/>;/);
  assert.doesNotMatch(runtime, /parentTddPilot|isParentPilot/);
  assert.doesNotMatch(runtime, /content=\{moduleKey === "parents"/);

  // The replacement provider is server-attested, not a client-side filter.
  assert.match(provider, /payload\.scopeCenterId !== centerId/);
  assert.match(provider, /new URLSearchParams\(\{ centerId, limit:/);
  assert.match(provider, /No unscoped\/legacy fallback/);
  assert.match(tdd, /ready\?\.centerId === selected/);
  assert.match(tdd, /<SurfaceWorkspace key=\{selected\}/);

  // Old generic Subscription writer remains intentionally blocked.
  assert.match(runtime, /if \(moduleKey === "subscriptions"\) return <BoRegistrationWorkspace/);
  assert.match(runtime, /data-testid="bo-subscription-center-contract-pending"/);
  assert.doesNotMatch(runtime, /<BoSubscriptionsView embedded \/>/);
  assert.doesNotMatch(page, /\.\.\.query/);
});
