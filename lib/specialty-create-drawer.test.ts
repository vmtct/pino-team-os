import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {specialtyVisualPaths,validateSpecialtyDraft} from "../app/ho/learning/specialties/schema";

const ho=readFileSync(new URL("../app/ho/learning/specialties/HoSpecialties.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/ho/learning/specialties/HoSpecialtyCreate.module.css",import.meta.url),"utf8");
const theme=readFileSync(new URL("../app/ho/ho-theme.css",import.meta.url),"utf8");
const admission=readFileSync(new URL("../config/tdd-admission.json",import.meta.url),"utf8");

test("PAP-1495/1491: Create form exactly name, 4 canonical Path select, optional description",()=>{
 assert.deepEqual(specialtyVisualPaths.map(p=>p.code),[
  "little-piner-art","little-piner-piano","artchitect","pianohouse"]);
 assert.deepEqual(specialtyVisualPaths.map(p=>p.label),[
  "Little Piner Art","Little Piner Piano","Artchitect","PianoHouse"]);
 assert.match(validateSpecialtyDraft({name:"AB",pathCode:"little-piner-art",description:""})??"",/3 đến 160/);
 assert.match(validateSpecialtyDraft({name:"Anime",pathCode:"staging-fixture",description:""})??"",/Path hợp lệ/);
 assert.match(validateSpecialtyDraft({name:"Anime",pathCode:"little-piner-art",description:"x".repeat(4001)})??"",/4.000/);
 assert.equal(validateSpecialtyDraft({name:"Anime",pathCode:"little-piner-art",description:""}),null);
 assert.equal((ho.match(/className="pds-property-input"/g)||[]).length,3);
 assert.doesNotMatch(ho,/select[^>]+name="status"|input[^>]+name="tags"|input[^>]+name="level"/);
});

test("PAP-1495/1491: DS Drawer saves only via real authorized Founder Core 201 + GET readback",()=>{
 for(const text of [
  'tableHeaderActions={<button className="primary-btn"',
  "＋ Tạo chuyên đề",
  '<DrawerFrame title="Tạo chuyên đề" path="Learning / Chuyên đề"',
  'id="ho-spec-create-form" className={createStyles.createForm} data-ho-specialty-create',
  'className="pds-property-label"',
  'minLength={3}','maxLength={160}',
  'ref={inputRef}','inputRef.current?.focus()',
  'type="submit" form="ho-spec-create-form"',
  'disabled={Boolean(invalid)||!paths||saving}',
  'readSpecialtyV2PathOptions(',
  'createSpecialtyV2Draft(',
 ])assert.ok(ho.includes(text),text);
 assert.doesNotMatch(ho,/localStorage|mock|fixture|pathProgramId:\s*["']01a/);
});

test("PAP-1495: owner-fenced layout-only Specialty CSS and shared PINO DS",()=>{
 assert.match(ho,/import createStyles from "\.\/HoSpecialtyCreate\.module\.css"/);
 assert.match(ho,/import "@pino\/design-system\/components\.css"/);
 assert.match(css,/\.createForm\s*\{/);
 assert.match(css,/\.field\s*\{/);
 assert.match(css,/grid-template-columns:\s*minmax\(0,1fr\)/);
 assert.match(css,/gap:\s*17px/);
 assert.match(css,/gap:\s*7px/);
 assert.doesNotMatch(css,/(?:border|color|font|padding|min-height|box-shadow)\s*:/);
 assert.match(admission,/"file": "app\/ho\/learning\/specialties\/HoSpecialtyCreate\.module\.css"/);
 assert.match(admission,/"owner": "PAP-1495"/);
 assert.match(admission,/"classes": \["createForm", "field"\]/);
 assert.doesNotMatch(theme,/PAP-1495 \/ SPEC-UNLOCK: approved HO Create Drawer form/);
 assert.doesNotMatch(ho,/className="v25-form-fields"|className="v25-form-field"/);
});
