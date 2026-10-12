import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/bo/pinoria-wish/CatalogManager.tsx", import.meta.url), "utf8");

test("Wish catalog no longer exposes retired wearable or variant mutations", () => {
  assert.equal(source.includes("pinoria/wish/catalog/wearables"), false);
  assert.equal(source.includes("pinoria/wish/catalog/variants"), false);
  assert.match(source, /href="\/bo\/pinoria-ward"/);
  assert.match(source, /Wearable\/Variant là Ward-owned/);
});
