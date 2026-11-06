import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { specialtyVisualPaths, validateSpecialtyDraft } from "../app/ho/learning/specialties/schema";

const ho = readFileSync(new URL("../app/ho/learning/specialties/HoSpecialties.tsx",import.meta.url),"utf8");
const scopedCss = readFileSync(new URL("../app/ho/learning/specialties/HoSpecialtyCreate.module.css",import.meta.url),"utf8");
const sharedTheme = readFileSync(new URL("../app/ho/ho-theme.css",import.meta.url),"utf8");
const admission = readFileSync(new URL("../config/tdd-admission.json",import.meta.url),"utf8");

test("PAP-1495: Create draft matches approved Specialty Path field and minimum length",()=>{
  assert.deepEqual(specialtyVisualPaths.map(path=>path.label),["Art Foundation","Piano Foundation"]);
  assert.match(validateSpecialtyDraft({name:"AB",pathCode:"art-foundation",description:""})??"",/3 đến 160/);
  assert.match(validateSpecialtyDraft({name:"Anime",pathCode:"forged",description:""})??"",/Path hợp lệ/);
  assert.match(validateSpecialtyDraft({name:"Anime",pathCode:"art-foundation",description:"x".repeat(4001)})??"",/4.000/);
  assert.equal(validateSpecialtyDraft({name:"Anime",pathCode:"art-foundation",description:"Mô tả"}),null);
});

test("PAP-1495: approved DrawerFrame uses DS inputs, focus, and no fake writer",()=>{
  for (const phrase of [
    'tableHeaderActions={<button className="primary-btn"',
    "＋ Tạo chuyên đề",
    '<DrawerFrame title="Tạo chuyên đề" path="Learning / Chuyên đề"',
    'id="ho-spec-create-form" className={createStyles.createForm} data-ho-specialty-create',
    'className={createStyles.field}',
    'className="pds-property-label"',
    'minLength={3}', 'maxLength={160}',
    'ref={inputRef}', 'inputRef.current?.focus()',
    'type="submit" form="ho-spec-create-form"', 'disabled aria-disabled="true"',
    "Chưa thể tạo chuyên đề.",
  ]) assert.ok(ho.includes(phrase),phrase);
  assert.equal((ho.match(/className="pds-property-input"/g)||[]).length,3);
  assert.doesNotMatch(ho,/api\/founder\/path-programs|fetch\(.*specialt|submitSpecialtyMutation|demo|mock|fixture/i);
});

test("PAP-1495: owner-fenced layout-only Specialty CSS + canonical DS component styles",()=>{
  assert.match(ho,/import createStyles from "\.\/HoSpecialtyCreate\.module\.css"/);
  assert.match(ho,/import "@pino\/design-system\/components\.css"/);
  assert.match(scopedCss,/\.createForm\s*\{/);
  assert.match(scopedCss,/\.field\s*\{/);
  assert.match(scopedCss,/grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(scopedCss,/gap:\s*17px/);
  assert.match(scopedCss,/gap:\s*7px/);
  assert.doesNotMatch(scopedCss,/(?:border|color|font|padding|min-height|box-shadow)\s*:/);
  assert.match(admission,/"file": "app\/ho\/learning\/specialties\/HoSpecialtyCreate\.module\.css"/);
  assert.match(admission,/"owner": "PAP-1495"/);
  assert.match(admission,/"classes": \["createForm", "field"\]/);
  assert.doesNotMatch(sharedTheme,/PAP-1495 \/ SPEC-UNLOCK: approved HO Create Drawer form/);
  assert.doesNotMatch(ho,/className="v25-form-fields"|className="v25-form-field"/);
});
