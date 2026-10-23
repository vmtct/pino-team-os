import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("PAP-879 BO pilot excludes legacy page chrome while preserving canonical classes/students", () => {
  const students = read("app/bo/learners/BoLearnersView.tsx");
  const classes = read("app/bo/BoOperationalView.tsx");
  const grid = read("app/bo/components/data-grid/BoDataGrid.tsx");
  const css = read("app/bo/components/data-grid/bo-data-grid.module.css");
  assert.doesNotMatch(students, /School · Student management/);
  assert.doesNotMatch(students, /Manager nhìn ngay ai đang học/);
  assert.match(students, />＋ Tạo mới<\/button>/);
  assert.match(classes, /<Page title="Classes" subtitle="">/);
  assert.doesNotMatch(classes, /Recurring operational schedule masters/);
  assert.doesNotMatch(classes, /Filter Running Classes by status/);
  assert.doesNotMatch(grid, /className=\{styles\.sortHint\}/);
  assert.match(css, /height:\s*var\(--bo-v23-table-row-height,\s*42px\)/);
  assert.match(css, /height:\s*var\(--bo-v23-table-heading-height,\s*35px\)/);
});