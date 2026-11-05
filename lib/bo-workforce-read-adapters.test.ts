import test from "node:test";
import assert from "node:assert/strict";
import { termWeeksAdapter, shiftPlansAdapter, availabilityAdapter, assignmentsAdapter } from "../app/bo/architecture/workforce-read-adapters";

const term = { id: "term-global", displayName: "Global Autumn", code: "AUTUMN", centerId: "compat-anchor", startDate: "2026-10-01", endDate: "2026-12-31" };
const week = { id: "global-week", termId: term.id, code: "W4", ordinal: 4, startDate: "2026-10-26", endDate: "2026-11-01" };
const bootstrap = { centers: [{ id: "center-a" }, { id: "center-b" }], terms: [], termWeeks: [] };
function snapshot(centerId: string) {
  const exists = centerId === "center-a";
  return {
    centerId, termWeekId: week.id, startDate: week.startDate, endDate: week.endDate,
    staff: [{ id: "staff-1", displayLabel: "Staff One" }],
    templates: [{ id: "shift-1", displayLabel: "Ca chiều" }],
    availability: exists ? [{ id: "avail-a", staffMemberId: "staff-1", centerId, termWeekId: week.id, status: "SUBMITTED", items: [{}] }] : [],
    assignments: exists ? [{ id: "assignment-a", staffMemberId: "staff-1", centerId, shiftTemplateId: "shift-1", workDate: "2026-10-27", status: "ACTIVE" }] : [],
    windows: {
      availability: { shiftPlanExists: exists, state: exists ? "OPEN" : "LOCKED", availabilityRegistrationOpen: exists },
      planning: { state: "OPEN" },
    },
  };
}
function mockFetch(denyCenterB = false) {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://bo.invalid");
    requests.push(url.toString());
    assert.equal(init?.method ?? "GET", "GET");
    assert.equal(init?.credentials, "same-origin");
    if (url.pathname.endsWith("/bootstrap")) return Response.json({ data: bootstrap });
    if (url.pathname.endsWith("/global-weeks")) {
      if (denyCenterB && url.searchParams.get("centerId") === "center-b") return Response.json({ error: { code: "ACCESS_PERMISSION_DENIED" } }, { status: 403 });
      return Response.json({ data: { terms: [term], termWeeks: [week] } });
    }
    if (url.pathname.endsWith("/weekly")) return Response.json({ data: snapshot(String(url.searchParams.get("centerId"))) });
    throw new Error("unexpected request: " + url.pathname);
  }) as typeof fetch;
  return { requests, restore: () => { globalThis.fetch = previous; } };
}
test("PAP-901 adapters dedupe Global weeks, preserve actual Center plans, and render authorized facts only", async () => {
  const { requests, restore } = mockFetch();
  try {
    const weeks = await termWeeksAdapter.list();
    const plans = await shiftPlansAdapter.list();
    const availability = await availabilityAdapter.list();
    const assignments = await assignmentsAdapter.list();
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0].term, "Global Autumn");
    assert.equal(plans.length, 1);
    assert.equal(plans[0].centerId, "center-a");
    assert.equal(availability.length, 1);
    assert.equal(assignments.length, 1);
    assert.ok(requests.every((url) => url.includes("/api/bo/workforce/planning/")));
    assert.ok(requests.some((url) => url.includes("global-weeks?centerId=center-b")));
  } finally { restore(); }
});
test("PAP-901 adapters fail closed when Global week read is forbidden in one Center", async () => {
  const { restore } = mockFetch(true);
  try {
    await assert.rejects(() => termWeeksAdapter.list(), /HTTP 403/);
  } finally { restore(); }
});
