import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BO_HOSTNAME, TOS_HOSTNAME, decideHostBoundary } from "./host-boundary";

const read = (path: string) => readFile(path, "utf8");

test("Effect Catalog is a governed BO-only page and API", () => {
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, "/bo/pinoria-effects"), { action: "next" });
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, "/api/bo/pinoria/effects/catalog"), { action: "next" });
  assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, "/bo/pinoria-effects"), { action: "not_found" });
  assert.deepEqual(decideHostBoundary(TOS_HOSTNAME, "/api/bo/pinoria/effects/catalog"), { action: "not_found" });
});

test("Effect Catalog is read-only and renders actual F2 full and mini previews", async () => {
  const [view, navigation, readHandler] = await Promise.all([
    read("app/bo/pinoria-effects/EffectCatalogView.tsx"),
    read("app/bo/navigation.ts"),
    read("lib/bo-read-handler.ts"),
  ]);
  assert.match(navigation, /href:\s*["']\/bo\/pinoria-effects["'],\s*label:\s*["']Effects["']/);
  assert.match(readHandler, /path === "pinoria\/effects\/catalog"/);
  assert.match(view, /fetch\("\/api\/bo\/pinoria\/effects\/catalog"/);
  assert.match(view, /LayeredCharacter/);
  assert.match(view, /effectSurface="FULL_AVATAR"/);
  assert.match(view, /effectSurface="HOUSE_MINI"/);
  assert.match(view, /resolvePinoriaEffectPresentation/);
  assert.match(view, /pinoria\/char-base\.png/);
  assert.match(view, /READ ONLY/);
  assert.doesNotMatch(view, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/);
  assert.doesNotMatch(view, /PLS multiplier|Wish modifier|walkSpeed|shader parameter/i);
});

test("Effect Catalog documents code authority instead of exposing behavior controls", async () => {
  const view = await read("app/bo/pinoria-effects/EffectCatalogView.tsx");
  assert.match(view, /Behavior lives in code/);
  assert.match(view, /does not edit shader, scale, locomotion, economy, RNG, PLS or Wish behavior/);
  assert.doesNotMatch(view, /type=["']range["']/);
  assert.doesNotMatch(view, /<select/);
});
