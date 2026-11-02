import test from "node:test";
import assert from "node:assert/strict";
import { authorizedWorkforceSnapshots, shiftPlansAdapter, availabilityAdapter, assignmentsAdapter } from "./workforce-read-adapters";
import { unifiedBoWorkspaceSource } from "./bo-unified-workspace-source";
import { boCenterModuleScope, boScopedModuleHref } from "../components/registration/BoGlobalCenterPolicy";

const A = "0199f001-0000-7000-8000-000000000001";
const B = "0199f001-0000-7000-8000-000000000002";
const payload = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const fakeFetcher = (authorizedCenters: string[], calls: string[]): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const path = String(input);
    calls.push(path);
    if (path === "/api/bo/workforce/planning/bootstrap")
      return payload({ centers: authorizedCenters.map(id => ({ id, displayName: id })) });
    if (path.startsWith("/api/bo/workforce/planning/global-weeks?"))
      return payload({ terms: [], termWeeks: [] });
    throw Error("Unexpected cross-Center read: " + path);
  }) as typeof fetch;

test("PAP-1329: three Workforce tables use the BO-global CENTER scope; payroll not implicitly admitted", () => {
  for (const key of ["workforce-shift-plans", "workforce-availability", "workforce-assignments"])
    assert.equal(boCenterModuleScope(key), "CENTER");
  assert.equal(boCenterModuleScope("payroll-periods"), "UNVERIFIED");
  assert.equal(boScopedModuleHref("/bo/workforce-assignments", "workforce-assignments", A, [A]),
    "/bo/workforce-assignments?centerId=" + A);
  assert.equal(boScopedModuleHref("/bo/workforce-assignments", "workforce-assignments", B, [A]),
    "/bo/workforce-assignments");
  assert.equal(boScopedModuleHref("https://untrusted.invalid/bo/workforce-assignments", "workforce-assignments", A, [A]),
    "https://untrusted.invalid/bo/workforce-assignments");
});

test("PAP-1329: shared Workforce snapshot only fetches the selected authorized Center", async () => {
  const calls: string[] = [];
  const x = await authorizedWorkforceSnapshots(fakeFetcher([A, B], calls), A);
  assert.deepEqual(x.snapshots, []);
  assert.deepEqual(x.weeks.weeksByCenter.map(w => w.centerId), [A]);
  assert.deepEqual(calls, [
    "/api/bo/workforce/planning/bootstrap",
    "/api/bo/workforce/planning/global-weeks?centerId=" + A,
  ]);
});

test("PAP-1329: revoked Center denied BEFORE any global-weeks/weekly request", async () => {
  const calls: string[] = [];
  await assert.rejects(authorizedWorkforceSnapshots(fakeFetcher([A], calls), B), /không được cấp quyền/);
  assert.deepEqual(calls, ["/api/bo/workforce/planning/bootstrap"]);
});

test("PAP-1329: each verified Workforce table shares the scoped read path", async () => {
  for (const adapter of [shiftPlansAdapter, availabilityAdapter, assignmentsAdapter]) {
    const calls: string[] = [];
    assert.deepEqual(await adapter.list(fakeFetcher([A, B], calls), A), []);
    assert.deepEqual(calls, [
      "/api/bo/workforce/planning/bootstrap",
      "/api/bo/workforce/planning/global-weeks?centerId=" + A,
    ]);
  }
});

test("PAP-1329: source fails closed before unscoped Workforce reads", async () => {
  let requests = 0;
  const fetcher = (async () => { requests++; throw Error("Should not fetch"); }) as typeof fetch;
  for (const key of ["workforce-shift-plans", "workforce-availability", "workforce-assignments"])
    await assert.rejects(unifiedBoWorkspaceSource.load(key, fetcher, {}), /Chưa chọn cơ sở/);
  assert.equal(requests, 0);
});

test("PAP-1329: dedicated routes use the single global BO provider, not another selector", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync("app/bo/architecture/BoWorkforceRoute.tsx", "utf8");
  assert.match(route, /useBoCenterSelection\(\)/);
  assert.match(route, /boCenterModuleScope\(moduleKey\) === "CENTER"/);
  assert.match(route, /!authorizedIds\.includes\(selected\)/);
  assert.match(route, /content=\{blocked \? <WorkforceCenterPending/);
  assert.doesNotMatch(route, /<BoCenterSelectionProvider>/);
});
