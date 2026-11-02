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
test("PAP-1075: server-gated preview does not replace canonical Parents or alter Core API", () => {
  const page = readFileSync("app/bo/page.tsx", "utf8");
  const runtime = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  assert.match(page, /getCloudflareContext\(\{ async: true \}\)/);
  assert.match(page, /boParentTddPilotAllowed\(env, incoming\.get\("host"\)/);
  assert.match(page, /parentTddPilot=\{parentTddPilot\}/);
  assert.match(runtime, /moduleKey === "parents" && parentTddPilot \? <ParentTdd \/>/);
  assert.match(runtime, /moduleKey === "subscriptions" \? <BoSubscriptionsView embedded \/>/);
  assert.doesNotMatch(page, /\.\.\.query/);
});
