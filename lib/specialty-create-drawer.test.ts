import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { specialtyVisualPaths, validateSpecialtyDraft } from "../app/ho/learning/specialties/schema";

const ho = readFileSync(new URL("../app/ho/learning/specialties/HoSpecialties.tsx",import.meta.url),"utf8");
const theme = readFileSync(new URL("../app/ho/ho-theme.css",import.meta.url),"utf8");

test("PAP-1495: Create draft matches approved Specialty Path field and minimum length",()=>{
  assert.deepEqual(specialtyVisualPaths.map(path=>path.label),["Art Foundation","Piano Foundation"]);
  assert.match(validateSpecialtyDraft({name:"AB",pathCode:"art-foundation",description:""})??"",/3 đến 160/);
  assert.match(validateSpecialtyDraft({name:"Anime",pathCode:"forged",description:""})??"",/Path hợp lệ/);
  assert.match(validateSpecialtyDraft({name:"Anime",pathCode:"art-foundation",description:"x".repeat(4001)})??"",/4.000/);
  assert.equal(validateSpecialtyDraft({name:"Anime",pathCode:"art-foundation",description:"Mô tả"}),null);
});

test("PAP-1495: shared DrawerFrame uses approved form semantics and no fake writer",()=>{
  for (const phrase of [
    'tableHeaderActions={<button className="primary-btn"',
    "＋ Tạo chuyên đề",
    '<DrawerFrame title="Tạo chuyên đề" path="Learning / Chuyên đề"',
    'id="ho-spec-create-form" className="ho-spec-form" data-ho-specialty-create',
    'className="ho-spec-field"',
    '<span>Tên chuyên đề <span aria-hidden="true">*</span></span>',
    '<span>Path</span>', '<span>Mô tả</span>',
    'minLength={3}', 'maxLength={160}',
    'ref={inputRef}', 'inputRef.current?.focus()',
    'type="submit" form="ho-spec-create-form"', 'disabled aria-disabled="true"',
    "Chưa thể tạo chuyên đề.",
  ]) assert.ok(ho.includes(phrase),phrase);
  assert.doesNotMatch(ho,/api\/founder\/path-programs|fetch\(.*specialt|submitSpecialtyMutation|demo|mock|fixture/i);
});

test("PAP-1495: scoped PINO DS form CSS prevents native inline input/select regression",()=>{
  const anchor='[data-surface="ho"] [data-ho-specialty-create]';
  for (const selector of [
    anchor+'.ho-spec-form',
    anchor+' .ho-spec-field',
    anchor+' .ho-spec-field > :is(input,select,textarea)',
    anchor+' .ho-spec-field textarea',
    anchor+' .ho-spec-field > :is(input,select,textarea):focus',
  ]) assert.ok(theme.includes(selector),selector);
  assert.match(theme,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(theme,/flex-direction:column/);
  assert.match(theme,/min-height:38px/);
  assert.match(theme,/width:100%/);
  assert.match(theme,/var\(--ds-border/);
  assert.match(theme,/var\(--ds-primary/);
  assert.doesNotMatch(ho,/className="v25-form-fields"|className="v25-form-field"/);
});
