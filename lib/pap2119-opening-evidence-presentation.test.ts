import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root="app/bo/opening-evidence/";
void test("PAP-2119 gallery uses meaningful bounded aspect-preserving private preview",()=>{
 const gallery=readFileSync(root+"OpeningEvidenceGallery.tsx","utf8"),css=readFileSync(root+"OpeningEvidencePresentation.module.css","utf8");
 assert.match(gallery,/className=\{styles\.photoPreview\}/);
 assert.match(gallery,/openingEvidenceApi\.photo\(row,assetId,controller\.signal\)/);
 assert.match(gallery,/URL\.revokeObjectURL/);
 assert.match(css,/width:\s*min\(100%, 320px\)/);
 assert.match(css,/aspect-ratio:\s*4 \/ 3/);
 assert.match(css,/object-fit:\s*contain/);
});
void test("PAP-2119 Full Detail selects existing business-v25 profile and wraps scoped tabs",()=>{
 const detail=readFileSync(root+"[subjectType]/[receiptId]/OpeningEvidenceDetail.tsx","utf8"),css=readFileSync(root+"OpeningEvidencePresentation.module.css","utf8");
 assert.match(detail,/<BoFullDetail designVariant="business-v25"/);
 assert.match(detail,/className=\{styles\.detail\}/);
 assert.match(css,/\.detail \[role="tablist"\]\s*\{[^}]*flex-wrap:\s*wrap/);
 assert.match(css,/\.detail \[role="tab"\]\s*\{[^}]*white-space:\s*normal/);
});