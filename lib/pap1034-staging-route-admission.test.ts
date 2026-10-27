import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isBoStagingRouteAdmitted } from "../app/bo/architecture/bo-staging-route-policy";
import { boModuleRegistry } from "../app/bo/architecture/registry";
import { unifiedBoWorkspaceSource } from "../app/bo/architecture/bo-unified-workspace-source";

test("PAP-1034 dedicated Subscription route admitted only in staging UI shell", () => {
  assert.equal(isBoStagingRouteAdmitted("/bo/subscriptions"),true);
  assert.equal(isBoStagingRouteAdmitted("/bo/subscriptions/admin"),false);
  assert.equal(isBoStagingRouteAdmitted("/bo/learners"),false);
  assert.equal(isBoStagingRouteAdmitted("/bo"),false);
});
test("Subscriptions uses standalone Core-connected screen, not workforce adapter or generic create", () => {
  assert.equal(boModuleRegistry.some(x => x.href === "/bo/subscriptions"),false);
  assert.equal(unifiedBoWorkspaceSource.routeForModule?.("subscriptions"),"/bo/subscriptions");
  assert.equal(unifiedBoWorkspaceSource.routeForModule?.("students"),"/bo");
  const boPage=readFileSync("app/bo/page.tsx","utf8");
  const dedicatedPage=readFileSync("app/bo/subscriptions/page.tsx","utf8");
  assert.match(boPage,/query\.module === "subscriptions"\) redirect\("\/bo\/subscriptions"\)/);
  assert.match(dedicatedPage,/BoSubscriptionsView/);
});
