import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/bo/pinoria-wish/CatalogManager.tsx", import.meta.url), "utf8");

test("Wish catalog keeps Ward definition authority while preserving the supported Wish projection write", () => {
  assert.match(source, /pinoria\/wish\/catalog\/wearables\/\$\{projection\.wearableId\}\/projection/);
  assert.match(source, /rarity:projection\.rarity,setId:projection\.setId\|\|null/);
  assert.doesNotMatch(source, /pinoria\/wish\/catalog\/variants/);
  assert.doesNotMatch(source, /pinoria\/wish\/catalog\/wearables\$\{editing/);
  assert.match(source, /href="\/bo\/pinoria-ward"/);
  assert.match(source, /definition\/lifecycle vẫn thuộc Ward/);
});
