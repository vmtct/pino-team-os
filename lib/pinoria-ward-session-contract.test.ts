import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("F3 TOS opens or resumes the visit-bound Ward session and confirms through Core", () => {
  const arrival = read("app/pinoria/arrival-desk.tsx");
  const choice = read("app/pinoria/ward-session-choice.tsx");
  const contract = read("lib/pinoria-ward-session.ts");
  assert.match(arrival, /pinoria\/wardrobe\/session\/open/);
  assert.match(arrival, /pinoria\/wardrobe\/session\/select/);
  assert.match(arrival, /idempotency-key/);
  assert.match(arrival, /wardConfirmCommand/);
  assert.match(arrival, /currentCommand\?\.candidateSetId === wardChoice\.session\.id/);
  assert.match(arrival, /currentCommand\.variantId === candidate\.id/);
  assert.match(arrival, /"idempotency-key": commandKey/);
  assert.match(arrival, /wardConfirmCommand\.current = null/);
  assert.match(arrival, /openWardChoice\(learner, true\)/);
  assert.match(arrival, /Check-in đã thành công\. Ward choice chưa mở được/);
  assert.match(arrival, /resumeWard/);
  assert.match(choice, /session\.candidates\.map/);
  assert.match(choice, /Xác nhận lựa chọn/);
  assert.match(contract, /candidates: \[WardSessionCandidate, WardSessionCandidate, WardSessionCandidate\]/);
});

test("F3 TV renders the shared persisted Ward session and has no mutation path", () => {
  const reception = read("app/pinoria-tv/reception-tv.tsx");
  const tv = read("app/pinoria-tv/ward-session-tv.tsx");
  assert.match(reception, /wardSession\?: WardSession/);
  assert.match(reception, /WardSessionTv/);
  assert.match(reception, /learner\.wardSession\?\.status === "OPEN"/);
  assert.match(reception, /houseSnapshotRefreshedAt/);
  assert.match(reception, /Date\.now\(\) - houseSnapshotRefreshedAt\.current >= 1500/);
  assert.match(tv, /session\.candidates\.map/);
  assert.match(tv, /session\.selectedVariantId/);
  assert.doesNotMatch(tv, /fetch\(/);
  assert.doesNotMatch(tv, /onClick=/);
  assert.doesNotMatch(tv, /\/api\/tos-learning/);
});

test("F3 choice surfaces consume Core render references instead of local asset definitions", () => {
  const contract = read("lib/pinoria-ward-session.ts");
  const choice = read("app/pinoria/ward-session-choice.tsx");
  const tv = read("app/pinoria-tv/ward-session-tv.tsx");
  assert.match(contract, /mode: "LAYER" \| "STANDALONE" \| "WEBM"/);
  assert.match(contract, /assetKey: string \| null/);
  assert.match(contract, /posterAssetKey: string \| null/);
  assert.match(choice, /candidate\.render\.assetKey/);
  assert.match(tv, /candidate\.render\.assetKey/);
  assert.match(choice, /wardRenderTransformStyle\(candidate\.render\.metadata\)/);
  assert.match(tv, /wardRenderTransformStyle\(candidate\.render\.metadata\)/);
  assert.doesNotMatch(choice, /candidate\.render\.mode === "LAYER" \? wardRenderTransformStyle/);
  assert.doesNotMatch(tv, /candidate\.render\.mode === "LAYER" \? wardRenderTransformStyle/);
  assert.match(choice, /<video[^>]+style=\{renderStyle\}/);
  assert.match(tv, /<video[^>]+style=\{renderStyle\}/);
  assert.match(contract, /transformOrigin/);
});
