import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/bo/components/data-grid/BoDataGrid.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/bo/components/data-grid/bo-data-grid.module.css", import.meta.url), "utf8");

test("PAP-874 Quick View is opt-in and requires existing row opener", () => {
  assert.match(source, /quickViewOpener = false/);
  assert.match(source, /showQuickViewOpener = quickViewOpener && Boolean\(onRowOpen\)/);
  assert.match(source, /onClick=\{\(\) => onRowOpen\?\.\(row\)\}/);
});

test("PAP-874 opener remains keyboard-accessible and loading columns align", () => {
  assert.match(source, /<button type="button" className=\{styles\.quickViewOpenerButton\}/);
  assert.match(source, /aria-label=\{`Open Quick View for \$\{key\}`\}/);
  assert.match(source, /visibleColumns\.length \+ \(showQuickViewOpener \? 1 : 0\)/);
});

test("PAP-874 opener width is scoped to BO V2.3 token", () => {
  assert.match(css, /\.quickViewOpenerCell\s*\{[^}]*--bo-v23-opener-column-width, 37px/);
  assert.match(css, /\.quickViewOpenerButton\s*\{[^}]*--bo-v23-color-accent-table/);
});
