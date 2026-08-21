import test from "node:test";
import assert from "node:assert/strict";
import { BO_HOSTNAME, decideHostBoundary, RETIRED_TEAM_HOSTNAME, TOS_HOSTNAME } from "./host-boundary";

test("TOS keeps its root, operational routes, APIs, and Founder behavior", () => {
  for (const pathname of ["/", "/dashboard", "/schedule", "/api/workforce/context", "/founder", "/api/founder/sessions"]) {
    assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, pathname), { action: "next" }, pathname);
  }
});

test("TOS cannot reach BO routes or the BO API", () => {
  for (const pathname of ["/bo", "/bo/", "/bo/anything", "/api/bo", "/api/bo/context"]) {
    assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("BO root redirects on the same host and only the bounded foundation is available", () => {
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, "/"), { action: "redirect", pathname: "/bo" });
  for (const pathname of ["/bo", "/bo/", "/api/bo/context", "/api/bo/context/", "/_next/static/app.js", "/favicon.ico"]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "next" }, pathname);
  }
});

test("BO cannot reach TOS, Companion, Founder, or unapproved BO routes", () => {
  for (const pathname of [
    "/dashboard",
    "/schedule",
    "/timesheet",
    "/check-in",
    "/companion",
    "/api/workforce/context",
    "/api/companion/login",
    "/founder",
    "/founder/sessions",
    "/api/founder/sessions",
    "/bo/users",
    "/api/bo/users",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("the retired team hostname always returns not found without a redirect", () => {
  for (const pathname of ["/", "/dashboard", "/bo", "/founder"]) {
    assert.deepEqual(decideHostBoundary(RETIRED_TEAM_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("local and preview hosts retain existing development behavior", () => {
  assert.deepEqual(decideHostBoundary("localhost:3000", "/dashboard"), { action: "next" });
  assert.deepEqual(decideHostBoundary("preview.example.workers.dev", "/bo"), { action: "next" });
});
