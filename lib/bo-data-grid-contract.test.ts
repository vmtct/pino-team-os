import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("app/bo/components/data-grid/BoDataGrid.tsx", "utf8");
const urlStateHook = readFileSync("app/bo/components/data-grid/useBoDataGridUrlState.ts", "utf8");
const css = readFileSync("app/bo/components/data-grid/bo-data-grid.module.css", "utf8");
const doctrine = readFileSync("docs/bo-data-grid-foundation-v1.md", "utf8");

test("PAP-383 Data Grid is presentation-only and keeps domain authority outside the primitive", () => {
  assert.doesNotMatch(component, /fetch\(|boApi|workforceApi|POST|PATCH|DELETE|PUT/);
  assert.match(doctrine, /presentation\/state orchestration only/);
  assert.match(doctrine, /never widens a read/);
});

test("PAP-383 Data Grid exposes the approved shared table and side-peek semantics", () => {
  for (const token of ["<table", "<caption", "aria-sort", "aria-selected", 'role="dialog"', 'aria-modal="true"', "Rows per page", "Previous page", "Next page"]) {
    assert.ok(component.includes(token), token);
  }
  for (const state of ["loading", "empty", "error", "permission"]) assert.ok(component.includes(state), state);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /height:\s*44px/);
  assert.match(css, /\.peek\s*\{/);
});

test("PAP-383 URL state remains deterministic and router-backed instead of browser business state", () => {
  assert.match(urlStateHook, /router\.replace/);
  assert.doesNotMatch(urlStateHook, /localStorage|sessionStorage/);
  for (const token of ["setSearch", "setSort", "setPage", "setPageSize", "setFilter", "clearFilters"]) assert.ok(urlStateHook.includes(token), token);
  assert.match(doctrine, /`q`, `sort`, `dir`, `page`, `size` and `f_<filter-key>`/);
});
