import test from "node:test";
import assert from "node:assert/strict";
import { BO_HOSTNAME, decideHostBoundary, requiresBoStaffPasswordSession, requiresTosStaffSession, RETIRED_TEAM_HOSTNAME, STAFF_REGISTRATION_HOSTNAME, TOS_HOSTNAME } from "./host-boundary";

const roleId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";

test("TOS keeps its root, operational routes, APIs, and Founder behavior", () => {
  for (const pathname of ["/", "/dashboard", "/schedule", "/classroom", "/training", "/open-studio", "/pinoria", "/pinoria/attendance", "/api/workforce/context", "/api/workforce/training/self", "/api/workforce/training/assignments/0198d050-56c1-7ac5-b9ab-b0e45d912345/lessons/complete", "/api/tos-learning/sessions/day", "/api/tos-learning/open-studio/day", "/founder", "/api/founder/sessions"]) {
    assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, pathname), { action: "next" }, pathname);
  }
});

test("TOS operational pages require a Staff session cookie", () => {
  for (const pathname of ["/", "/dashboard", "/schedule", "/classroom", "/training", "/open-studio", "/pinoria", "/pinoria/attendance", "/pinoria-tv", "/timesheet", "/check-in", "/info"]) assert.equal(requiresTosStaffSession(TOS_HOSTNAME, pathname), true, pathname);
  for (const pathname of ["/staff-login", "/api/staff-pin/login", "/api/workforce/context", "/companion", "/_next/static/app.js"]) assert.equal(requiresTosStaffSession(TOS_HOSTNAME, pathname), false, pathname);
  assert.equal(requiresTosStaffSession(BO_HOSTNAME, "/dashboard"), false);
});

test("TOS cannot reach BO routes or the BO API", () => {
  for (const pathname of ["/bo", "/bo/", "/bo/anything", "/api/bo", "/api/bo/context", "/api/bo/access/roles", "/bo/system/users"]) {
    assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("BO exposes local Staff password login while keeping BO pages password-gated", () => {
  for (const pathname of ["/staff-login", "/api/staff-auth/login", "/api/staff-auth/status", "/api/staff-auth/logout"]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "next" }, pathname);
    assert.equal(requiresBoStaffPasswordSession(BO_HOSTNAME, pathname), false, pathname);
  }
  for (const pathname of ["/bo", "/bo/system/users", "/staff-pin/change"]) assert.equal(requiresBoStaffPasswordSession(BO_HOSTNAME, pathname), true, pathname);
  assert.equal(requiresBoStaffPasswordSession(TOS_HOSTNAME, "/bo"), false);
});

test("BO root redirects on the same host and only governed BO routes are available", () => {
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, "/"), { action: "redirect", pathname: "/bo" });
  assert.deepEqual(decideHostBoundary("bo.pinohouse.art.", "/api/founder/ai/change-sets"), { action: "next" });
  assert.deepEqual(decideHostBoundary("BO.PINOHOUSE.ART.:443", "/api/founder/ai/change-sets"), { action: "next" });
  for (const pathname of [
    "/bo", "/bo/", "/bo/staff", "/bo/workforce", "/bo/workforce/check-in-exceptions", "/bo/workforce/timekeeping", "/bo/workforce/duty-exceptions", "/bo/training", "/bo/learners", "/bo/subscriptions", "/bo/open-studio", "/bo/delivery-activation",
    "/bo/running-classes", "/bo/sessions", "/bo/registrations", "/bo/syllabus", "/bo/practice", "/bo/pinoria-ward", "/bo/pinoria-ward/sets", "/bo/pinoria-ward/learners", "/bo/pinoria-effects", "/bo/content",
    "/bo/system/users", "/bo/system/roles", "/bo/system/audit", "/bo/system/ai-data",
    "/api/founder/ai/change-sets", `/api/founder/ai/change-sets/${roleId}`, `/api/founder/ai/change-sets/${roleId}/approve`, `/api/founder/ai/change-sets/${roleId}/reject`, `/api/founder/ai/change-sets/${roleId}/reconcile`,
    "/api/bo/context", "/api/bo/pinoria/effects/catalog", "/api/bo/pinoria/ward/sets", `/api/bo/pinoria/ward/sets/${roleId}`, `/api/bo/pinoria/ward/sets/${roleId}/members`, "/api/bo/pinoria/ward/set-webm-assets", "/api/bo/pinoria/ward/learners", `/api/bo/pinoria/ward/learners/${roleId}`, `/api/bo/pinoria/ward/learners/${roleId}/grants`, `/api/bo/pinoria/ward/learners/${roleId}/revocations`, `/api/bo/pinoria/ward/learners/${roleId}/loadout`, "/api/bo/web-cms/slots", `/api/bo/web-cms/slots/${roleId}`, `/api/bo/web-cms/slots/${roleId}/history`, `/api/bo/web-cms/slots/${roleId}/draft`, `/api/bo/web-cms/slots/${roleId}/publish`, `/api/bo/web-cms/slots/${roleId}/rollback`, "/api/bo/pinoria/ward/catalog", "/api/bo/pinoria/ward/catalog/items", `/api/bo/pinoria/ward/catalog/items/${roleId}`, "/api/bo/pinoria/ward/catalog/variants", `/api/bo/pinoria/ward/catalog/variants/${roleId}`, "/api/bo/learners", "/api/bo/student-intakes", "/api/bo/practice/authoring-context", "/api/bo/practice/repertoire-access/context", "/api/bo/practice/repertoire-access", "/api/bo/practice/repertoire-access/grants", `/api/bo/practice/repertoire-access/grants/${roleId}/revoke`, "/api/bo/practice/resources", "/api/bo/practice/media", `/api/bo/practice/resources/${roleId}`, `/api/bo/practice/resources/${roleId}/drafts`, `/api/bo/practice/versions/${roleId}`, `/api/bo/practice/versions/${roleId}/pages`, `/api/bo/practice/versions/${roleId}/publish`, "/api/bo/open-studio/operations", "/api/bo/open-studio/passes", "/api/bo/open-studio/listings",
    "/api/bo/open-studio/member-path-centers/assign", "/api/bo/open-studio/passes/issue-monthly-path", "/api/bo/open-studio/admission",
    `/api/bo/open-studio/passes/${roleId}/claim-eligibility`, `/api/bo/students/${roleId}/lifecycle`, `/api/bo/students/${roleId}/pinoria`, `/api/bo/students/${roleId}/pinoria/companions/${roleId}/feed`, `/api/bo/identity/parents/${roleId}/pin/reset`,
    "/api/bo/subscriptions", `/api/bo/subscriptions/${roleId}/renew`, "/api/bo/enrollments", `/api/bo/enrollments/${roleId}/end`,
    "/api/bo/centers", "/api/bo/delivery/bootstrap-state", "/api/bo/delivery/enrollment-activation", "/api/bo/delivery/term-weeks", "/api/bo/delivery/learning-spaces",
    "/api/bo/delivery/running-classes", "/api/bo/delivery/running-class-blocks", "/api/bo/delivery/materializations",
    "/api/bo/policies/delivery/materialization.v1/versions", `/api/bo/policies/delivery/materialization.v1/versions/${roleId}/publish`,
    "/api/bo/policies/open_studio/monthly_path_pass.v1/stream", "/api/bo/policies/open_studio/monthly_path_pass.v1/effective",
    "/api/bo/policies/open_studio/monthly_path_pass.v1/versions", `/api/bo/policies/open_studio/monthly_path_pass.v1/versions/${roleId}/publish`,
    "/api/bo/policies/open_studio/bring_a_friend.v1/stream", "/api/bo/policies/open_studio/public_acquisition.v1/versions", "/api/bo/policies/open_studio/cancellation.v1/effective",
    "/api/bo/path-programs", "/api/bo/running-classes", "/api/bo/syllabi", "/api/bo/sessions",
    "/api/bo/learning/syllabi", "/api/bo/learning/syllabi/owners", "/api/bo/learning/syllabi/media", `/api/bo/learning/syllabi/media/${roleId}/preview`, `/api/bo/learning/syllabi/${roleId}`, `/api/bo/learning/syllabi/${roleId}/draft`, `/api/bo/learning/syllabi/${roleId}/publish`, `/api/bo/learning/syllabi/${roleId}/next-draft`, `/api/bo/learning/syllabi/${roleId}/archive`, `/api/bo/learning/syllabi/versions/${roleId}/artchitect-profile`, `/api/bo/learning/syllabi/versions/${roleId}/pianohouse-profile`, `/api/bo/learning/syllabi/versions/${roleId}/little-piner-profile`,
    "/api/bo/access/roles", "/api/bo/access/permissions", "/api/bo/access/audit", "/api/bo/access/users",
    `/api/bo/access/roles/${roleId}`, `/api/bo/access/roles/${roleId}/duplicate`, `/api/bo/access/roles/${roleId}/update`, `/api/bo/access/roles/${roleId}/archive`,
    `/api/bo/access/users/${roleId}/staff-pin/reset`,
    "/api/bo/workforce/staff-records", "/api/bo/workforce/staff-onboarding", "/api/bo/workforce/staff-registration-settings", "/api/bo/workforce/staff-registration-requests", "/api/bo/workforce/timekeeping", "/api/bo/workforce/duty/checkout-exceptions", `/api/bo/workforce/duty/checkout-exceptions/${roleId}/approve`, `/api/bo/workforce/timekeeping/${roleId}/corrections`, `/api/bo/workforce/timekeeping/${roleId}/resolve-missed-checkout`, "/api/bo/workforce/planning/check-in-exceptions", "/api/bo/workforce/planning/check-in-exceptions/centers", `/api/bo/workforce/planning/check-in-exceptions/${roleId}`, `/api/bo/workforce/planning/check-in-exceptions/${roleId}/approve`, `/api/bo/workforce/planning/check-in-exceptions/${roleId}/decline`, `/api/bo/workforce/staff-registration-requests/${roleId}/approve`, `/api/bo/workforce/staff-registration-requests/${roleId}/reject`, "/api/bo/workforce/training/catalog", "/api/bo/workforce/training/modules", `/api/bo/workforce/training/modules/${roleId}/next-draft`, `/api/bo/workforce/training/modules/${roleId}/retire`, `/api/bo/workforce/training/assignments/${roleId}/signoff`, `/api/bo/workforce/training/qualifications/${roleId}/revoke`, "/api/bo/workforce/planning/weekly", "/api/bo/workforce/planning/assignment", "/api/bo/workforce/planning/assignment/cancel",
    "/api/bo/access/assignments", "/api/bo/access/assignments/remove", "/api/bo/access/users/status", "/api/bo/access/perimeter-reconcile",
    `/api/bo/workforce/staff-records/${roleId}`, `/api/bo/workforce/staff-records/${roleId}/status`, `/api/bo/workforce/staff-records/${roleId}/pinoria`,
    "/staff-pin/change", "/api/staff-pin/status", "/api/staff-pin/change", `/api/bo/sessions/${roleId}/registrations`, `/api/bo/delivery/sessions/${roleId}/syllabus-binding`,
    "/_next/static/app.js", "/favicon.ico",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "next" }, pathname);
  }
});

test("BO cannot reach TOS, Companion, Founder, or unapproved BO routes", () => {
  for (const pathname of [
    "/dashboard", "/schedule", "/classroom", "/timesheet", "/check-in", "/companion",
    "/api/workforce/context", "/api/tos-learning/sessions/day", "/api/tos-learning/open-studio/day", "/api/companion/login",
    "/founder", "/founder/sessions", "/api/founder/sessions", "/api/founder/ai/change-sets/not-a-canonical-id", "/api/founder/ai/change-sets/------------------------------------", "/api/founder/ai/change-sets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", `/api/founder/ai/change-sets/${roleId}/delete`, `/api/founder/ai/change-sets/${roleId}/approve/extra`, "/bo/users", "/bo/bookings", "/api/bo/users", "/api/bo/bookings",
    "/api/bo/web-cms/manifests/sync", "/api/bo/web-cms/slots/not-a-canonical-id", `/api/bo/web-cms/slots/${roleId}/retire`, `/api/bo/web-cms/slots/${roleId}/draft/extra`,
    "/api/bo/pinoria/ward/sets/not-a-canonical-id", `/api/bo/pinoria/ward/sets/${roleId}/delete`, `/api/bo/pinoria/ward/sets/${roleId}/members/extra`, "/api/bo/pinoria/ward/set-webm-assets/extra",
    "/api/bo/pinoria/ward/learners/not-a-canonical-id", `/api/bo/pinoria/ward/learners/${roleId}/delete`, `/api/bo/pinoria/ward/learners/${roleId}/loadout/extra`,
    "/api/bo/access/permissions/export", "/api/bo/access/audit/export", `/api/bo/access/roles/${roleId}/delete`,
    "/api/bo/delivery/learning-spaces/anything", "/api/bo/delivery/enrollment-activation/anything", `/api/bo/practice/resources/${roleId}/draft`, `/api/bo/practice/resources/${roleId}/publish`, `/api/bo/practice/versions/${roleId}/delete`,
    "/api/bo/policies/delivery/materialization.v1/versions/not-a-canonical-id/publish", "/api/bo/delivery/sessions/not-a-canonical-id/syllabus-binding", `/api/bo/delivery/sessions/${roleId}/syllabus-binding/extra`,
    "/api/bo/policies/open_studio/monthly_path_pass.v1/versions/not-a-canonical-id/publish", "/api/bo/policies/open_studio/unknown.v1/stream",
    "/api/bo/learning/syllabi/media/not-a-canonical-id/preview", "/api/bo/learning/syllabi/media/extra", "/api/bo/learning/syllabi/versions/not-a-canonical-id/artchitect-profile", `/api/bo/learning/syllabi/${roleId}/delete`,
    "/api/bo/policies/open_studio/monthly_path_pass.v1/delete", "/api/bo/sessions/not-a-canonical-id/registrations",
    "/api/bo/workforce/staff-records/not-a-canonical-id", `/api/bo/students/${roleId}/pinoria/companions/${roleId}/ritual`, `/api/bo/students/${roleId}/pinoria/companions/not-a-canonical-id/feed`, "/api/bo/workforce/training/delete-all", "/api/bo/workforce/training/modules/not-a-canonical-id/retire", "/api/bo/workforce/planning/anything", "/api/bo/workforce/planning/assignment/cancel/anything", "/api/bo/workforce/timekeeping/not-a-canonical-id/corrections", `/api/bo/workforce/timekeeping/${roleId}/delete`, `/api/bo/workforce/timekeeping/${roleId}/corrections/extra`, "/api/bo/workforce/duty/checkout-exceptions/not-a-canonical-id/approve", `/api/bo/workforce/duty/checkout-exceptions/${roleId}/delete`, `/api/bo/workforce/duty/checkout-exceptions/${roleId}/approve/extra`,
    `/api/bo/workforce/staff-records/${roleId}/anything`, `/api/bo/workforce/staff-records/${roleId}/pinoria/anything`, `/api/bo/access/users/${roleId}/staff-pin/reset/again`, "/api/staff-pin/configure",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("the retired team hostname always returns not found without a redirect", () => {
  for (const pathname of ["/", "/dashboard", "/bo", "/founder"]) {
    assert.deepEqual(decideHostBoundary(RETIRED_TEAM_HOSTNAME, pathname), { action: "not_found" }, pathname);
  }
});

test("join host is bounded to the employee registration surface", () => {
  for (const pathname of ["/staff/register", "/staff/register/", "/api/staff-registration", "/api/staff-registration/", "/_next/static/app.js", "/favicon.ico"]) assert.deepEqual(decideHostBoundary(STAFF_REGISTRATION_HOSTNAME, pathname), { action: "next" }, pathname);
  for (const pathname of ["/", "/bo", "/bo/staff", "/api/bo/workforce/staff-registration-requests", "/staff-login"]) assert.deepEqual(decideHostBoundary(STAFF_REGISTRATION_HOSTNAME, pathname), { action: "not_found" }, pathname);
});

test("staff registration paths are denied outside join while local and preview development remain usable", () => {
  for (const host of [TOS_HOSTNAME, BO_HOSTNAME, RETIRED_TEAM_HOSTNAME, "www.pinohouse.art"]) {
    for (const pathname of ["/staff/register", "/api/staff-registration"]) assert.deepEqual(decideHostBoundary(host, pathname), { action: "not_found" }, `${host}${pathname}`);
  }
  assert.deepEqual(decideHostBoundary("localhost:3000", "/staff/register"), { action: "next" });
  assert.deepEqual(decideHostBoundary("preview.example.workers.dev", "/api/staff-registration"), { action: "next" });
});

test("local and preview hosts retain existing development behavior", () => {
  assert.deepEqual(decideHostBoundary("localhost:3000", "/dashboard"), { action: "next" });
  assert.deepEqual(decideHostBoundary("preview.example.workers.dev", "/bo"), { action: "next" });
});
