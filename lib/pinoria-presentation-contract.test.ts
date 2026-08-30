import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Pinoria TV uses the unified Core presentation queue", () => {
  const binding = read("lib/staff-pin-core.ts");
  const route = read("app/api/pinoria-tv/presentation/route.ts");
  const reception = read("app/pinoria-tv/reception-tv.tsx");
  assert.match(binding, /claimPresentation/);
  assert.match(binding, /completePresentation/);
  assert.match(route, /PINO_PINORIA_TV_CORE\.claimPresentation/);
  assert.match(route, /PINO_PINORIA_TV_CORE\.completePresentation/);
  assert.match(reception, /presentation\?\.kind === "WISH_REVEAL"/);
  assert.match(reception, /presentation\?\.kind === "EGG_HATCH"/);
});

test("Egg Hatch presentation preserves the approved Mori visual recipe", () => {
  const scene = read("app/pinoria-tv/egg-hatch-scene.tsx");
  const css = read("app/pinoria-tv/egg-hatch.module.css");
  const activities = read("app/bo/pinoria-activities/PinoriaActivitiesView.tsx");
  const companions = read("app/bo/pinoria-companions/PinoriaCompanionsView.tsx");
  assert.match(scene, /hatch\.egg\.assetKey/);
  assert.match(scene, /hatch\.companion\.assetKey/);
  assert.match(scene, /hatch\.companion\.sigilAssetKey/);
  assert.match(css, /object-position:50% 50%/);
  assert.match(css, /transform-origin:50% 65%/);
  assert.match(css, /@keyframes eggShake/);
  assert.match(activities, /EGG_HATCH/);
  assert.match(companions, /pinoria\/Companion\/Egg-water\.png/);
  assert.match(companions, /pinoria\/Companion\/mori-sleep\.png/);
});
test("Companion Ritual stays on the generic Activity and TV presentation contracts", () => {
  const scene = read("app/pinoria-tv/companion-ritual-scene.tsx");
  const reception = read("app/pinoria-tv/reception-tv.tsx");
  const activities = read("app/bo/pinoria-activities/PinoriaActivitiesView.tsx");
  const tos = read("app/pinoria/activity-panel.tsx");
  const binding = read("lib/staff-pin-core.ts");
  assert.match(scene, /ritual\.companion\.assetKey/);
  assert.match(scene, /ritual\.companion\.sigilAssetKey/);
  assert.match(scene, /ritual\.companion\.fromLevel/);
  assert.match(scene, /ritual\.companion\.toLevel/);
  assert.match(scene, /CORE COMMITTED · TV PRESENTATION ONLY/);
  assert.match(reception, /COMPANION_RITUAL/);
  assert.match(activities, /COMPANION_RITUAL/);
  assert.match(activities, /companion-ritual-v1/);
  assert.match(tos, /ADVANCE_COMPANION_MATERIALIZATION/);
  assert.match(tos, /\/api\/tos-learning\/pinoria\/activities\/execute/);
  assert.match(binding, /"COMPANION_RITUAL"/);
});

test("Wish economy control stays in BO while TOS only discloses authoritative pity", () => {
  const boView = read("app/bo/pinoria-wish/WishBoView.tsx");
  const rules = read("app/bo/pinoria-wish/RuleManager.tsx");
  const tos = read("app/pinoria/activity-panel.tsx");
  assert.match(boView, /pinoria\/wish\/rules/);
  assert.match(boView, /form\.rulesVersion/);
  assert.match(rules, /\/simulate/);
  assert.match(rules, /lifecycle\(rule,"publish"\)/);
  assert.match(rules, /Simulate 50k/);
  assert.match(tos, /wish\.pity\.nextMythicPityPosition/);
  assert.match(tos, /wish\.pity\.featuredGuarantee/);
  assert.match(tos, /wish\.banner\.guarantees\.featuredMythicRate/);
  assert.doesNotMatch(tos, /pinoria\/wish\/rules/);
});
test("Companion readiness stays Core-authoritative and adds no TV scene", () => {
  const classroom=read("app/classroom/ClassroomView.tsx");
  const tos=read("app/pinoria/activity-panel.tsx");
  const api=read("lib/pinoria-readiness-api.ts");
  const reception=read("app/pinoria-tv/reception-tv.tsx");
  assert.match(classroom,/diaryRecordState === "ACTIVE"/);
  assert.match(classroom,/pinoriaReadinessApi\.grantFruit/);
  assert.match(classroom,/pinoriaReadinessApi\.awardWaterSigil/);
  assert.match(tos,/pinoriaReadinessApi\.state/);
  assert.match(tos,/pinoriaReadinessApi\.feed/);
  assert.match(tos,/coreProgress\.state !== "GROWING"/);
  assert.match(api,/pinoria\/companions\/feed/);
  assert.doesNotMatch(api,/READY_FOR_RITUAL.*=/);
  assert.doesNotMatch(reception,/FRUIT_GRANTED|COMPANION_FRUIT_FED|WATER_SIGIL/);
});
