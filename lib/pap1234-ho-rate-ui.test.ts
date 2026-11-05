import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { staffRateProvider } from "../app/ho/staff/staff-rate-provider";

test("PAP-1234 HO Staff Rate opts into approved compact PINO DS presentation only", () => {
  assert.deepEqual(staffRateProvider.presentation, {
    heading: "Mức lương mới",
    actionLabel: "Lưu mức lương",
    compact: true,
    hideRecordsToolbar: true,
  });
  assert.equal(staffRateProvider.surface, "HO");
  assert.equal(staffRateProvider.moduleKey, "staffs");
  assert.equal(staffRateProvider.slotId, "staff-rate");
  assert.equal(staffRateProvider.sourceAdapter, "salary.staff-rate");
});

test("PAP-1234 renderer keeps presentation optional and does not affect generic business form", () => {
  const renderer = readFileSync("app/components/workspace-renderer/Slots.tsx", "utf8");
  assert.match(renderer, /presentation\?:/);
  assert.match(renderer, /provider\?\.presentation/);
  assert.match(renderer, /showToolbar=\{!hideToolbar\}/);
  assert.match(renderer, /presentation\?\.heading \?\? slot\.label/);
  assert.match(renderer, /presentation\?\.actionLabel \?\? "Lưu"/);
  assert.match(renderer, /presentation\?\.compact \? <div className="pds-business-compact-workspace"/);
});

test("PAP-1234 CSS is scoped to HO Staff Rate business content and contains responsive DS controls", () => {
  const stylesheet = readFileSync("app/ho/ho-theme.css", "utf8");
  const marker = "/* PAP-1234: HO Staff Rate business content";
  assert.ok(stylesheet.includes(marker));
  const css = stylesheet.slice(stylesheet.indexOf(marker));
  assert.ok(css.includes('[data-surface="ho"] [data-tdd-business-slot="staff-rate"]'));
  for (const selector of css.split("\n").filter(line => line.trim().startsWith("["))) {
    assert.ok(selector.trim().startsWith('[data-surface="ho"] [data-tdd-business-slot="staff-rate"]'), selector);
  }
  for (const token of ["--ds-primary", "--ds-border", "--ds-surface", "overflow-x:auto", "@media(max-width:600px)"]) {
    assert.ok(css.includes(token), token);
  }
  assert.doesNotMatch(css, /rate-foot|\.data-grid-toolbar/);
});
