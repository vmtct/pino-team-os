// PAP-1754 · Epic PAP-1705 / PNR-AVATAR-CRUD
// Guard listbox DOM/CSS against fixed-height action button regression.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const component=readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/bo/pinoria-avatars/CreateAvatarDrawer.module.css",import.meta.url),"utf8");
test("PAP-1754 options override 36px action height and centered text",()=>{
 assert.match(component,/secondary-btn \$\{styles\.option\}/);
 assert.match(component,/className=\{styles\.optionState\}/);
 assert.match(component,/role="option"/);
 assert.match(css,/\.option:global\(\.secondary-btn\)\s*\{[^}]*height:\s*auto;/s);
 assert.match(css,/\.option:global\(\.secondary-btn\)\s*\{[^}]*text-align:\s*left;/s);
 assert.match(css,/\.option:global\(\.secondary-btn\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
 assert.match(css,/\.optionCopy strong\s*\{[^}]*overflow-wrap:\s*anywhere/s);
 assert.match(css,/\.optionState\s*\{[^}]*text-align:\s*left/s);
 assert.doesNotMatch(css,/\.option:global\(\.secondary-btn\)\s*\{[^}]*height:\s*36px/s);
});
test("PAP-1754 bounds list height and keeps keyboard-active choice in view",()=>{
 assert.match(css,/\.options\s*\{[^}]*max-height:\s*min\(48vh,\s*360px\)/s);
 assert.match(css,/\.options\s*\{[^}]*overflow-y:\s*auto/s);
 assert.match(component,/optionRefs\.current\[active\]\?\.scrollIntoView\(\{block:"nearest"\}\)/);
 assert.match(component,/onKeyDownCapture=\{onComboboxKeyDownCapture\}/);
 assert.match(component,/onMouseDown=\{e=>e\.preventDefault\(\)\}/);
});
