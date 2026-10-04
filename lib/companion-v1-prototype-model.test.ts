import assert from "node:assert/strict";
import test from "node:test";
import {
  currentRequirement,
  normalizeLevels,
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
    { level: 2, label: "Waking", visualKind: "WEBM", visualAssetKey: "wake.webm", metadata: "{}", requirementToNext: null },
  ],
};

const companion: OwnedCompanion = { id: "owned-1", speciesId: "mori", currentLevel: 1, progressByLevel: { 1: 3 }, bringAlong: true };

test("bring-along stays exclusive and can be cleared", () => {
  const list = [companion, { ...companion, id: "owned-2", bringAlong: false }];
  assert.deepEqual(setBringAlong(list, "owned-2").map((entry) => entry.bringAlong), [false, true]);
  assert.deepEqual(setBringAlong(list, null).map((entry) => entry.bringAlong), [false, false]);
});

test("manual level accepts any configured level without requirement gating", () => {
  assert.equal(setManualLevel(companion, 2, species).currentLevel, 2);
  assert.equal(setManualLevel(companion, 99, species).currentLevel, 1);
});

test("manual progress can exceed requirement and never auto-levels", () => {
  const progressed = setManualProgress(companion, 1, 12);
  assert.equal(progressed.progressByLevel[1], 12);
  assert.equal(progressed.currentLevel, 1);
  assert.equal(currentRequirement(progressed, species)?.quantity, 5);
});

test("normalizeLevels resequences levels and removes final requirement", () => {
  const normalized = normalizeLevels([
    { ...species.levels[1], level: 9, requirementToNext: { kind: "FRUIT", quantity: 9 } },
    { ...species.levels[0], level: 3 },
  ]);
  assert.deepEqual(normalized.map((entry) => entry.level), [1, 2]);
  assert.equal(normalized[1].requirementToNext, null);
});
