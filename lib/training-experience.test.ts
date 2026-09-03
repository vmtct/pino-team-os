import test from "node:test";
import assert from "node:assert/strict";
import type { TrainingExperienceDefinition } from "./training-experience";
import {
  TRAINING_EXPERIENCE_CONTRACT_V1,
  createTrainingExperienceRegistry,
} from "./training-experience";

function definition(revision: number): TrainingExperienceDefinition {
  return {
    contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
    experienceKey: "scenario-training",
    experienceRevision: revision,
    title: `Scenario ${revision}`,
    summary: "test",
    estimatedMinutes: 5,
    capabilities: [],
    Component: () => null,
  };
}

test("training experience registry keeps exact revisions side by side", () => {
  const registry = createTrainingExperienceRegistry([definition(1), definition(2)]);
  const first = registry.resolve({
    contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
    experienceKey: "scenario-training",
    experienceRevision: 1,
  });
  const second = registry.resolve({
    contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
    experienceKey: "scenario-training",
    experienceRevision: 2,
  });
  assert.equal(first.ok && first.definition.title, "Scenario 1");
  assert.equal(second.ok && second.definition.title, "Scenario 2");
});

test("unknown exact experience fails closed instead of falling back", () => {
  const registry = createTrainingExperienceRegistry([definition(1)]);
  const result = registry.resolve({
    contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
    experienceKey: "scenario-training",
    experienceRevision: 99,
  });
  assert.deepEqual(result.ok ? null : result.code, "EXPERIENCE_NOT_REGISTERED");
});

test("duplicate key and revision is rejected at registry construction", () => {
  assert.throws(
    () => createTrainingExperienceRegistry([definition(1), definition(1)]),
    /Duplicate training experience/,
  );
});
