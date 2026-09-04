import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAllowedPostPath } from "./bo-write-handler";

const student="01990000-0000-7000-8000-000000000001";
const companion="01990000-0000-7000-8000-000000000002";
const feed=`students/${student}/pinoria/companions/${companion}/feed`;

test("F4a facade allowlists only bounded Student Companion Feed",()=>{
  assert.equal(isAllowedPostPath(feed),true);
  assert.equal(isAllowedPostPath(`students/${student}/pinoria/companions/${companion}/ritual`),false);
  assert.equal(isAllowedPostPath(`students/${student}/pinoria/rewards/fruit/grant`),false);
});

test("F4a UI keeps replay key across retry and does not surface correction or lifecycle commands",async()=>{
  const [panel,api,handler]=await Promise.all([readFile(new URL("../app/bo/learners/StudentPinoriaPanel.tsx",import.meta.url),"utf8"),readFile(new URL("./bo-api.ts",import.meta.url),"utf8"),readFile(new URL("./bo-write-handler.ts",import.meta.url),"utf8")]);
  assert.match(panel,/retryKeys\.current\.get/);assert.match(panel,/feedLearnerCompanion/);
  assert.doesNotMatch(panel,/awardWaterSigil|grantFruit|executeCompanionRitual|createEgg/);
  assert.match(api,/feedLearnerCompanion/);assert.match(handler,/STUDENT_COMPANION_FEED_PATH\.test\(path\)[\s\S]*idempotencyKey/);
});
