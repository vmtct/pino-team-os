import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boCenterModuleScope, boScopedModuleHref, restoreBoAuthorizedCenter, scopedBoReadFetcher } from "./BoGlobalCenterPolicy";
import { BO_CENTER_READ_WAVE1 } from "./BoCenterWave1";

const A = "0199f001-0000-7000-8000-000000000001";
const B = "0199f001-0000-7000-8000-000000000002";

test("PAP-1327: central manifest adopts only audited Center read contracts", () => {
  for (const key of BO_CENTER_READ_WAVE1) assert.equal(boCenterModuleScope(key), "CENTER");
  for (const key of ["subscriptions", "enrollments", "parents"]) assert.equal(boCenterModuleScope(key), "MIXED");
  for (const key of ["staffs", "missions", "audits", "unknown"]) assert.equal(boCenterModuleScope(key), "UNVERIFIED");
  assert.equal(boScopedModuleHref("/bo?module=classes&record=old#detail", "classes", A, [A]), "/bo?module=classes&centerId=" + A);
  assert.equal(boScopedModuleHref("/bo?module=subscriptions", "subscriptions", A, [A]), "/bo?module=subscriptions");
  assert.equal(boScopedModuleHref("/bo?module=classes", "classes", B, [A]), "/bo?module=classes");
});

test("PAP-1327: URL precedence denies forged/deauthorized hints; stored selection is never ACL", () => {
  assert.deepEqual(restoreBoAuthorizedCenter([A], "", A), {selected:A,invalidExplicit:false});
  assert.deepEqual(restoreBoAuthorizedCenter([A], "", B), {selected:"",invalidExplicit:false});
  assert.deepEqual(restoreBoAuthorizedCenter([A], "?centerId="+B, A), {selected:"",invalidExplicit:true});
  assert.deepEqual(restoreBoAuthorizedCenter([A], "?centerId=forged", A), {selected:"",invalidExplicit:true});
  assert.deepEqual(restoreBoAuthorizedCenter([A,B], "?centerId="+B, A), {selected:B,invalidExplicit:false});
  assert.deepEqual(restoreBoAuthorizedCenter([A,B], "?centerId="+A+"&centerId="+B, A), {selected:"",invalidExplicit:true});
});

test("PAP-1327: one authenticated global BO provider, not per-module switcher instances", () => {
  const src = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  assert.match(src, /RuntimeContext.Provider value=\{currentUser\}><BoCenterSelectionProvider>\{children\}<\/BoCenterSelectionProvider>/);
  assert.equal((src.match(/<BoCenterSelectionProvider>/g) ?? []).length, 1);
  assert.match(src, /boCenterModuleScope\(moduleKey\) === "CENTER"/);
  assert.match(src, /scopedBoReadFetcher\(key, fetcher, selected\)/);
  const provider = readFileSync("app/bo/components/registration/BoCenterSelection.tsx", "utf8");
  assert.match(provider, /restoreBoAuthorizedCenter\(result\.centers\.map\(c => c\.id\)/);
  assert.match(provider, /sessionStorage\.setItem\(BO_ACTIVE_CENTER_SESSION_KEY, centerId\)/);
  assert.match(provider, /candidate\.invalidExplicit/);
  assert.match(provider, /useSearchParams\(\)\.toString\(\)/);
  assert.match(provider, /\[centers, loading, routeQuery\]/);
  assert.match(provider, /restore\(\);\s*window.addEventListener\("popstate", restore\)/);
});

test("PAP-1327: centralized scoped fetch rejects unverified modules before their reads", () => {
  assert.throws(() => scopedBoReadFetcher("subscriptions", fetch, A), /chưa có hợp đồng/);
  assert.throws(() => scopedBoReadFetcher("enrollments", fetch, A), /chưa có hợp đồng/);
  assert.equal(scopedBoReadFetcher("visits", fetch, A), fetch);
  assert.equal(scopedBoReadFetcher("timekeeping", fetch, A), fetch);
  assert.notEqual(scopedBoReadFetcher("students", fetch, A), fetch);
  assert.notEqual(scopedBoReadFetcher("classes", fetch, A), fetch);
});
