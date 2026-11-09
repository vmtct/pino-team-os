// PAP-1742 · Epic PAP-1705 / PNR-AVATAR-CRUD
// Source + actual shared typed PropertySections SSR regression; browser E2E follows CD.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PropertySections} from "../app/components/workspace-renderer/Properties";
import {selfSchema,selfDefinition} from "../app/bo/pinoria-avatars/schema";
import {toLegacyModule} from "./workspace-schema";
import type {BoRecord} from "./bo-registration";

const src=readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx",import.meta.url),"utf8");
test("PAP-1742 real Avatar Create declares a styled Nickname control in shared field row",()=>{
  assert.match(src,/const nicknameControl=\(/);
  assert.match(src,/className="pds-property-input" placeholder="Tên hiển thị của Avatar"/);
  assert.match(src,/nickname: \{[^\n]+control:nicknameControl/);
  assert.match(src,/maxLength=\{40\}/);
  const fields=toLegacyModule(selfSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields.filter(f=>f.key==="nickname");
  const draft:BoRecord={id:"",name:"",nickname:""};
  const html=renderToStaticMarkup(createElement(PropertySections,{variant:"drawer",fields,record:draft,sections:selfDefinition.drawer.sections,
    createFields:{nickname:{id:"ps-create-nickname",value:"",onChange:()=>{},control:createElement("input",{id:"ps-create-nickname",type:"text",className:"pds-property-input",maxLength:40})}}}));
  assert.match(html,/data-tdd-field="nickname"/);
  assert.match(html,/for="ps-create-nickname"/);
  assert.match(html,/data-tdd-custom-create-control=""/);
  assert.match(html,/class="pds-property-input"/);
  assert.doesNotMatch(html,/os-create-select/);
});
test("PAP-1742 captures first Escape in Person listbox ahead of native Drawer listener",()=>{
  assert.match(src,/onKeyDownCapture=\{onComboboxKeyDownCapture\}/);
  assert.match(src,/if\(e\.key==="Escape"&&open\)\{e\.preventDefault\(\);e\.stopPropagation\(\);setOpen\(false\);\}/);
  assert.match(src,/onKeyDown=\{onComboboxKeyDown\}/);
  assert.doesNotMatch(src,/<div className="property-row"/);
});
