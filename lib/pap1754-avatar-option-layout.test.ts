// PAP-1754 · Epic PAP-1705 / PNR-AVATAR-CRUD
// Guard business CSS containment and the single canonical BO CSS authority.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const component=readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx",import.meta.url),"utf8");
const business=readFileSync(new URL("../app/bo/pinoria-avatars/CreateAvatarDrawer.module.css",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/bo-authority-source/bo-form-extension.css",import.meta.url),"utf8");
const compiled=readFileSync(new URL("../public/bo-authority-source/bo-scoped.css",import.meta.url),"utf8");
test("PAP-1754 Person options use BO authority, never fixed-height business CSS",()=>{
 assert.match(component,/className="secondary-btn ps-avatar-person-option"/);
 assert.match(component,/className="ps-avatar-person-option-state"/);
 assert.match(component,/role="option"/);
 assert.match(component,/data-avatar-person-options=""/);
 assert.doesNotMatch(business,/ps-avatar-person-option/);
 assert.match(css,/#drawer button\.ps-avatar-person-option\.secondary-btn\s*\{[^}]*height:\s*auto;/);
 assert.match(css,/#drawer button\.ps-avatar-person-option\.secondary-btn\s*\{[^}]*text-align:\s*left;/);
 assert.match(css,/#drawer button\.ps-avatar-person-option\.secondary-btn\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
 assert.match(css,/#drawer \.ps-avatar-person-option strong\s*\{[^}]*overflow-wrap:\s*anywhere/);
 assert.match(css,/#drawer \.ps-avatar-person-option-state\s*\{[^}]*text-align:\s*left/);
 assert.match(compiled,/:where\(html\[data-bo-ui-authority="v25"\]\) #drawer button\.ps-avatar-person-option\.secondary-btn/);
});
test("PAP-1754 scroll, responsive and keyboard are registered in canonical BO-only stylesheet",()=>{
 assert.match(css,/#drawer \[data-avatar-person-options\]\s*\{[^}]*max-height:\s*min\(48vh,\s*360px\)/);
 assert.match(css,/#drawer \[data-avatar-person-options\]\s*\{[^}]*overflow-y:\s*auto/);
 assert.match(css,/@media \(min-width: 768px\)/);
 assert.match(component,/optionRefs\.current\[active\]\?\.scrollIntoView\(\{block:"nearest"\}\)/);
 assert.match(component,/onKeyDownCapture=\{onComboboxKeyDownCapture\}/);
 assert.match(component,/onMouseDown=\{e=>e\.preventDefault\(\)\}/);
});
