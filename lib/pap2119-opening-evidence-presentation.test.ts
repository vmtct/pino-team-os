import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root="app/bo/opening-evidence/";
void test("PAP-2119 gallery reuses bounded canonical private media preview",()=>{
 const gallery=readFileSync(root+"OpeningEvidenceGallery.tsx","utf8"),css=readFileSync(root+"OpeningEvidencePresentation.module.css","utf8"),shared=readFileSync("app/bo/bo.module.css","utf8");
 assert.match(gallery,/className=\{styles\.photoPreview\}/);
 assert.match(gallery,/className=\{boStyles\.mediaPreviewFrame\}/);
 assert.match(gallery,/openingEvidenceApi\.photo\(row,assetId,controller\.signal\)/);
 assert.match(gallery,/URL\.revokeObjectURL/);
 assert.match(css,/max-width:\s*320px/);
 assert.match(shared,/\.mediaPreviewFrame\s*\{[^}]*aspect-ratio:\s*4 \/ 3[^}]*object-fit:contain/);
});
void test("PAP-2119 Full Detail selects existing business-v25 profile without shell overrides",()=>{
 const detail=readFileSync(root+"[subjectType]/[receiptId]/OpeningEvidenceDetail.tsx","utf8"),css=readFileSync(root+"OpeningEvidencePresentation.module.css","utf8");
 assert.match(detail,/<BoFullDetail designVariant="business-v25"/);
  assert.doesNotMatch(css,/#(?:detail-screen|drawer|typed-table)|\[data-tdd-shell|tablist|object-fit|aspect-ratio|!important/);
 // Every content selector stays scoped to a local module class, including nested variants.
 const selectors=[...css.replace(/\/\*[\s\S]*?\*\//g,"").matchAll(/(?:^|[{}])\s*([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith("@"));
 assert.ok(selectors.length>8);
 for(const selector of selectors)assert.match(selector,/^\.(?:evidenceTab|gallery|round|photos|photoPreview|note|decision|review|reviewForm|reason|actions)$/);
 assert.match(detail,/openingEvidenceApi\.review\(row,verdict,note,key\)/);
 assert.match(detail,/className="primary-btn"/);
 assert.match(detail,/className="secondary-btn"/);
 assert.match(detail,/className="edit-input"/);
 assert.match(detail,/type="submit" data-evidence-approve="true"/);
 assert.doesNotMatch(css,/(?:^|[;{])\s*(?:color|background|border(?:-radius)?|padding|margin|font(?:-size|-weight)?)\s*:/m);
 const gallery=readFileSync(root+"OpeningEvidenceGallery.tsx","utf8");
 assert.match(gallery,/r\.roundId===e\.roundId&&r\.version>e\.version/);
 assert.match(gallery,/openingReviewActorLabel\(review\.actorLegalFullName,review\.reviewAccountRecorded\)/);
});
