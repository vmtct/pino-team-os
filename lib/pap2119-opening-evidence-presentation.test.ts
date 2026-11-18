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
 assert.doesNotMatch(css,/tablist|role=|flex-wrap|object-fit|border/);
});