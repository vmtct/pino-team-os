import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const planner = readFileSync(new URL("../app/bo/components/workforce/BoWorkforceWeekPlanner.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/bo/bo.module.css", import.meta.url), "utf8");

test("PAP-1185 has one canonical 7-day grid without duplicate day navigation", () => {
  assert.doesNotMatch(planner, /weekPlannerDayNav|weekPlannerDayScroll|navRef|dayIndex|function jump/);
  assert.doesNotMatch(css, /\.weekPlannerDayNav|\.weekPlannerDayScroll/);
  assert.match(planner, /<colgroup>/);
  assert.match(planner, /className=\{styles\.weekPlannerStaffColumn\}/);
  assert.match(planner, /dates\.map\(\(date\) => \(\s*<col key=\{date\} className=\{styles\.weekPlannerDayColumn\}/);
  assert.match(planner, /<th scope="col" key=\{date\} data-day=\{date\}>/);
  assert.match(planner, /<table aria-label="Weekly Workforce planning matrix">/);
  assert.match(planner, /role="region"/);
  assert.match(planner, /aria-controls="workforce-planner-detail"/);
  assert.match(planner, /onSelect\(staff\.id, date\)/);
});

test("PAP-1185 day columns use one exact width at all breakpoints", () => {
  assert.match(css, /--week-planner-day-width:\s*128px/);
  assert.match(css, /--week-planner-staff-width:\s*165px/);
  assert.match(css, /--week-planner-table-width:\s*1061px/);
  assert.match(css, /--week-planner-table-width:\s*1018px/);
  assert.match(css, /\.weekPlannerTableScroll \.weekPlannerDayColumn\s*\{\s*width:\s*var\(--week-planner-day-width\)/);
  assert.match(css, /\.weekPlannerTableScroll th:not\(:first-child\),\s*\.weekPlannerTableScroll td\s*\{\s*width:\s*var\(--week-planner-day-width\);\s*min-width:\s*var\(--week-planner-day-width\);\s*max-width:\s*var\(--week-planner-day-width\)/);
  assert.match(css, /\.weekPlannerTableScroll th:first-child\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0;/);
});
