// PAP-1734 · Epic PAP-1705 / PNR-AVATAR-CRUD · Native DSA Create/View parity, PAP-1810 migration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { avatarFields, avatarSections } from "../app/bo/pinoria-avatars/avatar-dsa-model";
import { defaultTable, type BoRecord } from "./bo-registration";

const fields=avatarFields;
const keys=["name","nickname"];
const editable=fields.filter(field=>keys.includes(field.key));
const mock:BoRecord={id:"PERSON_00000000-0000-0000-0000-000000000001",name:"Synthetic Learner",nickname:"Mây",createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
test("PAP-1734 native DSA Create/View share Avatar fields and canonical property rows",()=>{
  const view=renderToStaticMarkup(createElement(PropertySections,{variant:"drawer",fields,sections:avatarSections,record:mock}));
  const create=renderToStaticMarkup(createElement(PropertySections,{variant:"drawer",fields:editable,sections:avatarSections,record:{...mock,id:""},createFields:{
    name:{id:"ps-create-person",value:"",onChange:()=>{},required:true,label:"Person *",control:createElement("input",{id:"ps-create-person",role:"combobox","aria-expanded":false})},
    nickname:{id:"ps-create-nickname",value:"Mây",onChange:()=>{},maxLength:40}
  }}));
  for(const key of keys){assert.match(create,new RegExp('data-tdd-field="'+key+'"'));assert.match(view,new RegExp('data-tdd-field="'+key+'"'));}
  assert.equal((create.match(/data-tdd-custom-create-control/g)||[]).length,1);
  assert.match(create, /for="ps-create-person"/);
  assert.match(create, /role="combobox"/);
  assert.match(create, /id="ps-create-nickname"/);
  assert.match(view,/Mây/);
  assert.doesNotMatch(view,/data-tdd-custom-create-control/);
  assert.ok(avatarSections.some(s=>s.id==="system"));
  assert.ok(!defaultTable(avatarFields).visible.includes("nickname"),"Nickname is drawer-only by default, five primary Table columns unchanged");
});
test("PAP-1734 native Avatar Create reuses shared PropertySections, no custom property-row fork",()=>{
  const source=readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx",import.meta.url),"utf8");
  assert.match(source, /<PropertySections variant="drawer" fields=\{drawerEditableFields\}/);
  assert.match(source, /sections=\{avatarSections\}/);
  assert.match(source, /control:personPicker/);
  assert.match(source, /<PropertySections variant="drawer" fields=\{auditFields\}/);
  assert.doesNotMatch(source, /<section className="property-section"/);
  assert.doesNotMatch(source, /<div className="property-row"/);
  assert.doesNotMatch(source, /<label className="property-label"/);
});
