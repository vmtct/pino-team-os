import test from "node:test";
import assert from "node:assert/strict";
import { buildEffectCatalogGridRows, isEffectCatalogGridSortKey, type EffectCatalogDefinition } from "./bo-pinoria-effects-grid";

const catalog: EffectCatalogDefinition[] = [
  { key: "TINY", displayName: "Tiny", rarity: "COMMON", implementationVersion: 2, description: "Small traveler", capabilities: ["FULL_AVATAR", "HOUSE_MINI"], fullAvatarDescription: "Small", houseMiniDescription: "Mini" },
  { key: "RAINBOW", displayName: "Rainbow", rarity: "LEGENDARY", implementationVersion: 4, description: "Rainbow aura", capabilities: ["FULL_AVATAR"], fullAvatarDescription: "Rainbow", houseMiniDescription: "Unsupported" },
  { key: "GHOST", displayName: "Ghost", rarity: "EPIC", implementationVersion: 3, description: "Ghost effect", capabilities: ["HOUSE_MINI"], fullAvatarDescription: "Unsupported", houseMiniDescription: "Ghost" },
];

test("Effects grid search and rarity filter remain presentation-only and deterministic", () => {
  assert.deepEqual(buildEffectCatalogGridRows(catalog, { search: "house mini" }).map((row) => row.item.key), ["GHOST", "TINY"]);
  assert.deepEqual(buildEffectCatalogGridRows(catalog, { rarity: "legendary" }).map((row) => row.item.key), ["RAINBOW"]);
  assert.deepEqual(buildEffectCatalogGridRows(catalog, { search: "no-match" }), []);
});

test("Effects grid supports the declared shared sort keys with canonical-key tie breaking", () => {
  assert.deepEqual(buildEffectCatalogGridRows(catalog, { sortKey: "version", sortDirection: "desc" }).map((row) => row.item.key), ["RAINBOW", "GHOST", "TINY"]);
  assert.deepEqual(buildEffectCatalogGridRows(catalog, { sortKey: "rarity", sortDirection: "asc" }).map((row) => row.item.key), ["TINY", "GHOST", "RAINBOW"]);
  for (const key of ["effect", "rarity", "version", "capabilities", "surfaces"]) assert.equal(isEffectCatalogGridSortKey(key), true);
  assert.equal(isEffectCatalogGridSortKey("authority"), false);
});
