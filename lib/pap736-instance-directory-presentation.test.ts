import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const directory = readFileSync(new URL("../app/bo/pinoria-world/PinoriaInstanceDirectory.tsx", import.meta.url), "utf8");
const manager = readFileSync(new URL("../app/bo/pinoria-world/PinoriaWorldManager.tsx", import.meta.url), "utf8");

test("PAP-736 list reads bounded canonical global directory, not N+1 learner fanout", () => {
  assert.match(directory, /pinoria\/worlds\/instances\?\$\{params\}/);
  for (const key of ["limit", "offset", "sortKey", "sortDirection"]) assert.match(directory, new RegExp(key));
  assert.doesNotMatch(directory, /pinoria\/worlds\/learners\/\$\{/);
  assert.match(directory, /<BoDataGrid\s/);
  assert.match(manager, /<PinoriaInstanceDirectory\s*\/>/);
});

test("PAP-736 row detail is lazy, authenticated, and surfaced in common side peek", () => {
  assert.match(directory, /PinoriaInstanceDetail id=\{selected\.id\}/);
  assert.doesNotMatch(directory, /pinoria\/worlds\/instances\/\$\{selected\.id\}/);
  assert.match(directory, /<PinoriaInstanceDetail\s/);
  assert.match(directory, /cache:"no-store"/);
  assert.match(directory, /controller\.abort\(\)/);
});

test("PAP-736 honors bounded paging and fail-closed permission state", () => {
  assert.match(directory, /pageSizeOptions:\[10,25,50,100\]/);
  assert.match(directory, /"permission"/);
  assert.match(directory, /if\(!response\.ok\|\|!payload\.data\)/);
});

test("PAP-736 primary grid does not eagerly load first learner details", () => {
  assert.doesNotMatch(manager, /Promise\.all\(\[loadCatalog\(\),loadLearners\(\)\]\)/);
  assert.match(manager, /if\(!legacyOpen\)return/);
  assert.match(manager, /if\(!legacyOpen\|\|!studentId\)/);
});
