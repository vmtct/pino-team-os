import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx", import.meta.url), "utf8");

test("PAP-2108: focused Starter retry moves focus before its button unmounts", () => {
  assert.match(source, /<input id="ps-create-nickname" type="text" ref=\{nicknameRef\}/);
  assert.match(source, /if\(document\.activeElement===e\.currentTarget\)nicknameRef\.current\?\.focus\(\);setCatalogRetry\(n=>n\+1\)/);
  assert.match(source, /<DrawerFrame\b/);
  assert.match(source, /setStarterLoading\(true\)/);
});
test("PAP-2108: native autofocus cannot steal the shared dialog invoker", () => { assert.doesNotMatch(source, /\bautoFocus\b/); });
