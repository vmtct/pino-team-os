import test from "node:test";
import assert from "node:assert/strict";
import { BO_HOSTNAME, decideHostBoundary, requiresTosStaffSession, RETIRED_TEAM_HOSTNAME, TOS_HOSTNAME } from "./host-boundary";

const roleId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";

test("TOS keeps its root, operational routes, APIs, and Founder behavior", () => {
  for (const pathname of ["/", "/dashboard", "/schedule", "/classroom", "/open-studio", "/pinoria", "/pinoria/attendance", "/api/workforce/context", "/api/tos-learning/sessions/day", "/api/tos-learning/open-studio/day", "/founder", "/api/founder/sessions"]) {
    assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, pathname), { action: "next" }, pathname);
  }
});

test("TOS operational pages require a Staff session cookie", () => {
  for (const pathname of ["/", "/dashboard", "/schedule", "/classroom", "/open-studio", "/pinoria", "/pinoria/attendance", "/pinoria-tv", "/timesheet", "/check-in", "/info"]) assert.equal(requiresTosStaffSession(TOS_HOSTNAME, pathname), true, pathname);
  for (const pathname of ["/staff-login", "/api/staff-pin/login", "/api/workforce/context", "/companion", "/_next/static/app.js"]) assert.equal(requiresTosStaffSession(TOS_HOSTNAME, pathname), false, pathname);
  assert.equal(requiresTosStaffSession(BO_HOSTNAME, "/dashboard"), false);
});

test("TOS cannot reach BO routes or the BO API", () => {
  for (const pathname of ["/bo", "/bo/", "/bo/anything", "/api/bo", "/api/bo/context", "/api/bo/access/roles", "/bo/system/users"]) {
    assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("BO root redirects on the same host and only governed BO routes are available", () => {
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, "/"), { action: "redirect", pathname: "/bo" });
  for (const pathname of [
    "/bo", "/bo/", "/bo/staff", "/bo/workforce", "/bo/learners", "/bo/open-studio", "/bo/delivery-activation",
    "/bo/running-classes", "/bo/sessions", "/bo/registrations", "/bo/syllabus", "/bo/practice",
    "/bo/system/users", "/bo/system/roles", "/bo/system/audit",
    "/api/bo/context", "/api/bo/learners", "/api/bo/practice/authoring-context", "/api/bo/practice/resources", "/api/bo/practice/media", `/api/bo/practice/resources/${roleId}`, `/api/bo/practice/resources/${roleId}/drafts`, `/api/bo/practice/versions/${roleId}`, `/api/bo/practice/versions/${roleId}/pages`, `/api/bo/practice/versions/${roleId}/publish`, "/api/bo/open-studio/operations", "/api/bo/open-studio/passes", "/api/bo/open-studio/listings",
    "/api/bo/open-studio/member-path-centers/assign", "/api/bo/open-studio/passes/issue-monthly-path", "/api/bo/open-studio/admission",
    `/api/bo/open-studio/passes/${roleId}/claim-eligibility`, `/api/bo/students/${roleId}/lifecycle`, `/api/bo/identity/parents/${roleId}/pin/reset`,
    "/api/bo/subscriptions", `/api/bo/subscriptions/${roleId}/renew`, "/api/bo/enrollments", `/api/bo/enrollments/${roleId}/end`,
    "/api/bo/centers", "/api/bo/delivery/bootstrap-state", "/api/bo/delivery/enrollment-activation", "/api/bo/delivery/learning-spaces",
    "/api/bo/delivery/running-classes", "/api/bo/delivery/running-class-blocks", "/api/bo/delivery/materializations",
    "/api/bo/policies/delivery/materialization.v1/versions", `/api/bo/policies/delivery/materialization.v1/versions/${roleId}/publish`,
    "/api/bo/policies/open_studio/monthly_path_pass.v1/stream", "/api/bo/policies/open_studio/monthly_path_pass.v1/effective",
    "/api/bo/policies/open_studio/monthly_path_pass.v1/versions", `/api/bo/policies/open_studio/monthly_path_pass.v1/versions/${roleId}/publish`,
    "/api/bo/policies/open_studio/bring_a_friend.v1/stream", "/api/bo/policies/open_studio/public_acquisition.v1/versions", "/api/bo/policies/open_studio/cancellation.v1/effective",
    "/api/bo/path-programs", "/api/bo/running-classes", "/api/bo/syllabi", "/api/bo/sessions",
    "/api/bo/access/roles", "/api/bo/access/permissions", "/api/bo/access/audit", "/api/bo/access/users",
    `/api/bo/access/roles/${roleId}`, `/api/bo/access/roles/${roleId}/duplicate`, `/api/bo/access/roles/${roleId}/update`, `/api/bo/access/roles/${roleId}/archive`,
    `/api/bo/access/users/${roleId}/staff-pin/reset`,
    "/api/bo/workforce/staff-records", "/api/bo/workforce/staff-onboarding", "/api/bo/workforce/planning/weekly", "/api/bo/workforce/planning/assignment", "/api/bo/workforce/planning/assignment/cancel",
    "/api/bo/access/assignments", "/api/bo/access/assignments/remove", "/api/bo/access/users/status", "/api/bo/access/perimeter-reconcile",
    `/api/bo/workforce/staff-records/${roleId}`, `/api/bo/workforce/staff-records/${roleId}/status`,
    "/staff-pin/change", "/api/staff-pin/status", "/api/staff-pin/change", `/api/bo/sessions/${roleId}/registrations`,
    "/_next/static/app.js", "/favicon.ico",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "next" }, pathname);
  }
});

test("BO cannot reach TOS, Companion, Founder, or unapproved BO routes", () => {
  for (const pathname of [
    "/dashboard", "/schedule", "/classroom", "/timesheet", "/check-in", "/companion",
    "/api/workforce/context", "/api/tos-learning/sessions/day", "/api/tos-learning/open-studio/day", "/api/companion/login",
    "/founder", "/founder/sessions", "/api/founder/sessions", "/bo/users", "/bo/bookings", "/api/bo/users", "/api/bo/bookings",
    "/api/bo/access/permissions/export", "/api/bo/access/audit/export", `/api/bo/access/roles/${roleId}/delete`,
    "/api/bo/delivery/learning-spaces/anything", "/api/bo/delivery/enrollment-activation/anything", `/api/bo/practice/resources/${roleId}/draft`, `/api/bo/practice/resources/${roleId}/publish`, `/api/bo/practice/versions/${roleId}/delete`,
    "/api/bo/policies/delivery/materialization.v1/versions/not-a-canonical-id/publish",
    "/api/bo/policies/open_studio/monthly_path_pass.v1/versions/not-a-canonical-id/publish", "/api/bo/policies/open_studio/unknown.v1/stream",
    "/api/bo/policies/open_studio/monthly_path_pass.v1/delete", "/api/bo/sessions/not-a-canonical-id/registrations",
    "/api/bo/workforce/staff-records/not-a-canonical-id", "/api/bo/workforce/planning/anything", "/api/bo/workforce/planning/assignment/cancel/anything",
    `/api/bo/workforce/staff-records/${roleId}/anything`, `/api/bo/access/users/${roleId}/staff-pin/reset/again`, "/api/staff-pin/configure",
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
