import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const manager = readFileSync(resolve(root, "app/bo/pinoria-wish/ReleasePhaseManager.tsx"), "utf8");
const view = readFileSync(resolve(root, "app/bo/pinoria-wish/WishBoView.tsx"), "utf8");

test("Wish Release Phase UI stays on canonical Founder 0058 authority", () => {
  assert.match(view, /<ReleasePhaseManager/);
  assert.match(manager, /fetch\(`\/api\/founder\/\$\{path\}`/);
  assert.match(manager, /familyKey:"LIMITED_WARDROBE"/);
  assert.match(manager, /maxFeaturedSlots:2/);
  assert.match(manager, /\[1,2\]\.map/);
  assert.match(manager, /type ReleaseRole = "NEW" \| "RERUN" \| "SEASONAL"/);
  assert.match(manager, /expectedVersion:editing\.version/);
  assert.match(manager, /expectedBannerVersion:banner\.version/);
  assert.doesNotMatch(manager, /\/api\/bo\/|PINO_BO_CORE|D1Database|NOTION/);
});
