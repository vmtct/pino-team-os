import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReadMissionProjectedSlot } from "../app/bo/missions/schema";

// PAP-1924 — BO Mission Diary/History false-deny from sanitized TDD projection.
// Epic PAP-1676 — MISSION ASSIGNMENT is keeping this scoped feature-first repair.
const center = "01900000-0000-7000-8000-000000000001";
const assignment = "01900000-0000-7000-8000-000000000002";

test("PAP-1924 — Mission Diary and History must not use hidden Center from projected records", () => {
  const src = readFileSync("app/bo/missions/BoMissionsTdd.tsx", "utf8");
  const projection = readFileSync("app/components/workspace-renderer/projection.ts", "utf8");
  const schema = readFileSync("app/bo/missions/schema.ts", "utf8");
  assert.match(projection, /schema\.fields\.filter\(f => allowsField\(schema, context, f\.key, "display"\)\)/);
  assert.match(schema, /key: "center"[\s\S]{0,190}display: false/);
  assert.doesNotMatch(src, /record\.center\s*!==\s*centerId/, "Projected TDD record drops hidden Center");
  assert.doesNotMatch(src, /row\.center\s*===\s*context\.centerId/, "History must not depend on hidden Center");
  assert.match(src, /canReadMissionProjectedSlot\(context,\s*record\.id\)/);
  assert.match(src, /canReadMissionProjectedSlot\(context,\s*row\.id\)/);
  assert.match(src, /readMissionLinkedDiaries\(fetch, centerId, record\.id, signal\)/);
});

test("PAP-1924 — effective selected-Center BO read is allowed; HO, absent grant and malformed scope are denied", () => {
  const bo = (centerId: string, allowed: boolean) => ({
    surface: "BO" as const, centerId,
    authorize: (permission: string) => allowed && permission === "student.mission_assignment.view",
  });
  assert.equal(canReadMissionProjectedSlot(bo(center, true), assignment), true, "Authorized BO must not be denied by hidden UI field");
  assert.equal(canReadMissionProjectedSlot(bo(center, false), assignment), false);
  assert.equal(canReadMissionProjectedSlot(bo("bad", true), assignment), false);
  assert.equal(canReadMissionProjectedSlot(bo("", true), assignment), false);
  assert.equal(canReadMissionProjectedSlot(bo(center, true), "not-a-uuid"), false);
  assert.equal(canReadMissionProjectedSlot({ surface: "HO", authorize: () => true }, assignment), false);
});

test("PAP-1924 — source uses one read scope, retains Core/BFF checks and no grant bypass", () => {
  const src = readFileSync("app/bo/missions/BoMissionsTdd.tsx", "utf8");
  const helper = readFileSync("app/bo/missions/schema.ts", "utf8");
  const reader = readFileSync("lib/bo-mission-assignments.ts", "utf8");
  assert.match(src, /const centerId = context\.surface === "BO" \? context\.centerId : null/);
  assert.match(helper, /context\.authorize\(permission\)/);
  assert.match(helper, /assignmentUuid\.test\(context\.centerId\)/);
  assert.match(helper, /assignmentUuid\.test\(assignmentId\)/);
  assert.match(reader, /\/api\/bo\/learning\/mission-assignments\//);
  assert.match(reader, /new URLSearchParams\(\{centerId,limit:"100",offset:String\(offset\)\}\)/);
});
