import assert from "node:assert/strict";
import test from "node:test";
import { actorHasSource, type PresenceActor } from "../app/pinoria-tv/presence-contract";
import { housePresenceSceneIsCurrent } from "../app/pinoria-tv/house-event-sequence";

const actor = (id: string, sourceId: string, companion: boolean): PresenceActor => ({
  pinoriaSelfId: id, actorType: "LEARNER", displayName: id, characterId: null,
  character: null, loadout: null, wardRender: null,
  experience: companion ? { schemaVersion: 1, studentProfileId: id, path: null, runningClass: null, learningSpace: null, companion: { id: `pet-${id}`, species: { id: "species", key: "mori", displayName: "Mori", assetKey: "same.png", presentationProfileKey: "default" }, materializationLevel: 1, state: "GROWING", stageFeedCount: 0 }, resources: { plsBalance: 0, fruitBalance: 0 } } : null,
  sources: [{ actorType: "LEARNER", sourceType: "STUDENT_VISIT", sourceId, openedAt: "2026-10-17T00:00:00Z" }],
});

test("Arrival companion cannot leak across actors or replaced visit source", () => {
  const inside = [actor("a", "visit-a-new", true), actor("b", "visit-b", true), actor("c", "visit-c", false)];
  const forScene = (id: string, source: string) => {
    const found = inside.find((entry) => entry.pinoriaSelfId === id);
    const matches = Boolean(found && actorHasSource(found, "STUDENT_VISIT", source));
    return { current: housePresenceSceneIsCurrent("arrival", Boolean(found), matches), companion: matches ? found?.experience?.companion ?? null : null };
  };
  assert.equal(forScene("a", "visit-a-old").current, false);
  assert.equal(forScene("a", "visit-a-old").companion, null);
  assert.equal(forScene("b", "visit-a-new").companion, null);
  assert.equal(forScene("b", "visit-b").companion?.id, "pet-b");
  assert.equal(forScene("c", "visit-c").companion, null);
  assert.equal(forScene("missing", "visit-b").companion, null);
});

test('Arrival canonical Path is source-bound and optional', () => {
  const current = actor('p', 'visit-p', true);
  if (!current.experience) throw new Error('fixture missing experience');
  current.experience.path = { id: 'path-p', code: 'PINO_PATH', displayName: 'Hành trình của P' };
  const resolvePath = (sourceId: string) => actorHasSource(current, 'STUDENT_VISIT', sourceId) ? current.experience?.path ?? null : null;
  assert.equal(resolvePath('visit-old'), null);
  assert.equal(resolvePath('visit-p')?.displayName, 'Hành trình của P');
  assert.equal(actor('q', 'visit-q', false).experience?.path ?? null, null);
});
