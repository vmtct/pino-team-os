import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SelfDirectoryProperties } from "../app/bo/pinoria-avatars/SharedProperties";
import type { OverviewProperties } from "../app/components/workspace-renderer/Properties";
const props: OverviewProperties = {
  record: { id:"self-1",name:"An",avatarStatus:"READY",roles:["Teacher","Reception"],secret:"PRIVATE" },
  fields: [
    {key:"name",label:"Họ tên",type:"text",icon:"Aa",w:180},
    {key:"avatarStatus",label:"Avatar",type:"select",icon:"◉",w:120,options:["READY"]},
    {key:"roles",label:"Vai trò",type:"multiselect",icon:"◉",w:120},
  ],
  sections:[{id:"overview",label:"Thông tin",fields:["name","avatarStatus","roles","secret"]}],
};
test("PAP-1170 readonly BO presenter preserves projected values and BO formatting",()=>{
 const html=renderToStaticMarkup(createElement(SelfDirectoryProperties,props));
 assert.ok(html.includes('data-pds-field="name"'));
 assert.ok(html.includes('datatag blue')&&html.includes('READY'));
 assert.ok(html.includes('Teacher')&&html.includes('Reception'));
 assert.ok(!html.includes('PRIVATE')&&!html.includes('data-pds-field="secret"'));
 assert.ok(!html.includes('<button')&&!html.includes('<input')&&!html.includes('<select'));
});
test("PAP-1170 empty/denied projection cannot expose fields from the raw record",()=>{
 const html=renderToStaticMarkup(createElement(SelfDirectoryProperties,{...props,fields:[],sections:[]}));
 assert.ok(!html.includes('PRIVATE')&&!html.includes('Teacher')&&!html.includes('READY'));
 assert.ok(!html.includes('<button'));
});
