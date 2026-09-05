import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../app/bo/BoOperationalView.tsx",import.meta.url),"utf8");
test("BO Session curriculum binding exposes exact readiness without latest fallback",()=>{
  assert.match(source,/Session curriculum binding/);
  assert.match(source,/bindingState === "FROZEN"/);
  assert.match(source,/Bind exact version/);
  assert.match(source,/Change exact version/);
  assert.match(source,/Correction reason/);
  assert.match(source,/Chọn exact version/);
  assert.match(source,/projection\.candidates\.map/);
  assert.doesNotMatch(source,/latestPublished|selectLatest|latest version/i);
});
