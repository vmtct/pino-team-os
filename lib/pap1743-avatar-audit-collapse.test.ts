// PAP-1743 · Epic PAP-1705 / PNR-AVATAR-CRUD · DSA native audit disclosure.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PropertySections} from "../app/components/workspace-renderer/Properties";
import {selfSchema,selfDefinition} from "../app/bo/pinoria-avatars/schema";
import {parentSchema,parentDefinition} from "../app/bo/parents/schema";
import {toLegacyModule} from "./workspace-schema";
import type {BoRecord} from "./bo-registration";
const fields=toLegacyModule(selfSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields;
const record:BoRecord={id:"synthetic-avatar",name:"Synthetic",nickname:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
const render=(variant:"drawer"|"detail",selectedFields=fields)=>
  renderToStaticMarkup(createElement(PropertySections,{variant,fields:selectedFields,record,sections:selfDefinition.drawer.sections}));
test("PAP-1743 Avatar View/CREATE audit is a native closed details section with shared field rows",()=>{
  const view=render("drawer");
  const creator=render("drawer",fields.filter(f=>["createdAt","createdBy","updatedAt","updatedBy"].includes(f.key)));
  for(const html of [view,creator]){
    assert.match(html,/<details[^>]+data-tdd-properties="drawer"[^>]+data-tdd-collapsed=""/);
    assert.match(html,/<summary>Thông tin hệ thống<\/summary>/);
    assert.doesNotMatch(html,/<details[^>]+open=/);
    for(const field of ["createdAt","createdBy","updatedAt","updatedBy"])
      assert.match(html,new RegExp('data-tdd-field="'+field+'"'));
  }
  assert.equal((view.match(/<details/g)||[]).length,1);
  const src=readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx",import.meta.url),"utf8");
  assert.match(src,/<PropertySections variant="drawer" fields=\{auditFields\}/);
  assert.doesNotMatch(src,/<details className="property-section pino-avatar-audit">/);
});
test("PAP-1743 opt-in collapse does not change normal Parent Drawer nor Full Detail",()=>{
  const normal=renderToStaticMarkup(createElement(PropertySections,{variant:"drawer",
    fields:toLegacyModule(parentSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields,
    sections:parentDefinition.drawer.sections,record:{id:"synthetic-parent",name:"Parent"}}));
  assert.doesNotMatch(normal,/<details/);
  assert.doesNotMatch(render("detail"),/<details/);
});
