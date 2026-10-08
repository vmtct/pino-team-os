import assert from "node:assert/strict";
import test from "node:test";
import {
  currentRequirement,
  normalizeLevels,
  normalizeRequirementQuantity,
  reconcileOwnedCompanionAfterLevelRemoval,
  resolveActiveGrantSpeciesId,
  setBringAlong,
  setManualLevel,
  setManualProgress,
  type CompanionSpecies,
  type OwnedCompanion,
} from "./companion-v1-prototype-model";

const species: CompanionSpecies = {
  id: "mori",
  key: "mori-water",
  name: "Mori",
  status: "ACTIVE",
  metadata: "{}",
  levels: [
    { level: 1, label: "Sleeping", visualKind: "PNG", visualAssetKey: "sleep.png", metadata: "{}", requirementToNext: { kind: "FRUIT", quantity: 5 } },
    { level: 2, label: "Waking", visualKind: "WEBM", visualAssetKey: "wake.webm", metadata: "{}", requirementToNext: { kind: "FRUIT", quantity: 3 } },
    { level: 3, label: "Flowing", visualKind: "WEBM", visualAssetKey: "flow.webm", metadata: "{}", requirementToNext: null },
  ],
};

const companion: OwnedCompanion = { id: "owned-1", speciesId: "mori", currentLevel: 2, progressByLevel: { 1: 5, 2: 3, 3: 8 }, bringAlong: true };

test("bring-along stays exclusive and can be cleared", () => {
  const list = [companion, { ...companion, id: "owned-2", bringAlong: false }];
  assert.deepEqual(setBringAlong(list, "owned-2").map((entry) => entry.bringAlong), [false, true]);
  assert.deepEqual(setBringAlong(list, null).map((entry) => entry.bringAlong), [false, false]);
});

test("manual level accepts any configured level without requirement gating", () => {
  assert.equal(setManualLevel(companion, 3, species).currentLevel, 3);
  assert.equal(setManualLevel(companion, 99, species).currentLevel, 2);
});

test("manual progress can exceed requirement and never auto-levels", () => {
  const progressed = setManualProgress(companion, 2, 12);
  assert.equal(progressed.progressByLevel[2], 12);
  assert.equal(progressed.currentLevel, 2);
  assert.equal(currentRequirement(progressed, species)?.quantity, 3);
});

test("normalizeLevels resequences levels and removes final requirement", () => {
  const normalized = normalizeLevels([
    { ...species.levels[2], level: 9, requirementToNext: { kind: "FRUIT", quantity: 9 } },
    { ...species.levels[0], level: 3 },
  ]);
  assert.deepEqual(normalized.map((entry) => entry.level), [1, 2]);
  assert.equal(normalized[1].requirementToNext, null);
});

test("level removal keeps surviving definition/progress identity aligned", () => {
  const reconciled = reconcileOwnedCompanionAfterLevelRemoval(companion, "mori", 1, 2);
  assert.equal(reconciled.currentLevel, 1);
  assert.deepEqual(reconciled.progressByLevel, { 1: 3, 2: 8 });

  const removedCurrentFinal = reconcileOwnedCompanionAfterLevelRemoval({ ...companion, currentLevel: 3 }, "mori", 3, 2);
  assert.equal(removedCurrentFinal.currentLevel, 2);
  assert.equal(removedCurrentFinal.progressByLevel[2], 3);
});

test("level removal does not touch a different species", () => {
  const other = { ...companion, speciesId: "doro" };
  assert.deepEqual(reconcileOwnedCompanionAfterLevelRemoval(other, "mori", 1, 2), other);
});

test("stale grant target fails closed when archived or missing", () => {
  assert.equal(resolveActiveGrantSpeciesId([species], "mori"), "mori");
  assert.equal(resolveActiveGrantSpeciesId([{ ...species, status: "ARCHIVED" }], "mori"), null);
  assert.equal(resolveActiveGrantSpeciesId([species], "missing"), null);
});

test("requirement quantity normalizes to a non-negative integer", () => {
  assert.equal(normalizeRequirementQuantity(-3), 0);
  assert.equal(normalizeRequirementQuantity(2.9), 2);
  assert.equal(normalizeRequirementQuantity(Number.NaN), 0);
});
