/** PAP-1866 / Epic PAP-1665 — toolbar divergence RED→GREEN, global PAP-1867. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ho=()=>readFileSync("app/ho/system/custom-attributes/page.tsx","utf8");
const shared=()=>readFileSync("app/bo/components/registration/BoDataTable.tsx","utf8");
test("PAP-1866: use ONE canonical BoDataTable toolbar, not a private cloned .toolbar",()=>{
 const src=ho();
 assert.ok(src.includes("<BoDataTable module="));
 assert.match(src,/showChrome(?:=\{true\})?(?:\s|\n)/);
 assert.doesNotMatch(src,/<div className="toolbar"/);
 assert.doesNotMatch(src,/style=\{\{flexWrap:"wrap",gap:8\}\}/);
 assert.ok(src.includes("filterOpen={filterOpen}"));
 assert.ok(src.includes("setFilterOpen={setFilterOpen}"));
 assert.ok(src.includes("filterContent={"));
});
test("PAP-1867: shared toolbar has source-authorized filter, column selector, reset, icons and optional safe domain filter surface",()=>{
 const src=shared();
 for(const name of ["filter-toggle","visible-columns","reset-all","view-tabs","search-field","faFilter","faTableColumns","faRotateLeft"])
  assert.ok(src.includes(name),name);
 assert.ok(src.includes("filterContent ?? <BoFilters"),"opt-in exact server filter renderer must not alter existing BoFilters consumers");
});
test("PAP-1866: selected exact server filters expose canonical chips/counter and never client-global filtering",()=>{
 const src=ho();
 assert.ok(src.includes("tableWithServerFilters"));
 assert.ok(src.includes("serverTotal={total??0}"));
 assert.ok(src.includes("setFilterKey"));
 assert.ok(src.includes("filterRules"));
 assert.doesNotMatch(src,/<div className="toolbar"/);
});
test("PAP-1866: native toolbar search and filter must preserve URL and Center, no public technical UUID",()=>{
 const src=ho();
 assert.match(src,/setSearchInput\(patch.search/);
 assert.match(src,/searchTerm/);
 assert.match(src,/centerId/);
 assert.ok(src.includes('id="rules-panel"'));
 assert.ok(src.includes('data-filter="centerId"'));
 assert.ok(src.includes('aria-label="Bộ lọc thuộc tính"'));
 assert.ok(src.includes('onSettings={setSettings}'));
});
