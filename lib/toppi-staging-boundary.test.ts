import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BO_HOSTNAME, decideHostBoundary } from "./host-boundary";

test("Toppi canonical staging stays isolated from the production BO host", () => {
  for (const pathname of [
    "/bo/toppi",
    "/bo/toppi/enrollments",
    "/api/toppi-staging/students",
    "/api/toppi-staging/enrollments",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("synthetic Toppi staging bindings never leak into production Wrangler config", () => {
  const production = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
  const staging = readFileSync(join(process.cwd(), "wrangler.toppi-staging.jsonc"), "utf8");
  for (const marker of ["TOPPI_STAGING_MODE", "pino-core-toppi-staging", "toppi-staging-operator"]) {
    assert.equal(production.includes(marker), false, marker);
  }
  assert.match(staging, /"TOPPI_STAGING_MODE": "canonical-synthetic"/);
  assert.match(staging, /"service": "pino-core-staging"/);
  assert.match(staging, /"entrypoint": "BoAccessControlPlane"/);
});

test("Toppi staging facade fails closed unless canonical synthetic mode and Core binding are present", () => {
  const route = readFileSync(join(process.cwd(), "app", "api", "toppi-staging", "[...path]", "route.ts"), "utf8");
  assert.match(route, /env\.TOPPI_STAGING_MODE !== "canonical-synthetic" \|\| !env\.PINO_BO_CORE/);
  assert.match(route, /status: 503/);
  assert.match(route, /env\.PINO_BO_CORE\.execute\(coreRequest, identity\)/);
  assert.equal(route.includes("PINO_CORE"), false);
});
