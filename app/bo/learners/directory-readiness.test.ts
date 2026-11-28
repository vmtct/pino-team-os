import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { showStudentsWhileCatalogLoads } from "./directory-readiness";

test("requires staging, the current authorized Center, and a completed directory", () => {
  for (const staging of [false, true]) for (const center of [false, true]) for (const state of ["loading", "error", "ready"] as const) {
    assert.equal(showStudentsWhileCatalogLoads(staging, center, state), staging && center && state === "ready");
  }
});

test("catalog failure stays terminal; the early grid has no write, public view or detail handlers", () => {
  const view = readFileSync(new URL("./BoLearnersView.tsx", import.meta.url), "utf-8");
  const error = view.indexOf('if (catalog.state === "error") return');
  const early = view.indexOf('if (catalog.state === "loading") {');
  const regular = view.indexOf('<div className={styles.headingActions}>', early);
  assert.ok(error >= 0 && early > error && regular > early);
  assert.match(view.slice(early, regular), /<BoDataGrid rows=\{visibleRows\}/);
  assert.doesNotMatch(view.slice(early, regular), /showCreate|LearnerDetail|setNeutralizeTarget|onRowOpen|publicViewRuntime/);
  assert.match(view, /canEditName=\{catalogReady && canEditName\}/);
  assert.match(view, /key=\{activeCenter\}/);
});
