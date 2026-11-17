// PAP-1847 / PNR-AVATAR-CRUD — native PINO DSA singleton semantic Nickname row.
import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {avatarModule,avatarSections} from "@/app/bo/pinoria-avatars/avatar-dsa-model";
import type {BoRecord} from "@/lib/bo-registration";
const record:BoRecord={id:"synthetic",name:"Avatar",nickname:"Mây"};
const fields=avatarModule.fields;
const sections=avatarSections;
const count=(html:string,text:string)=>html.split(text).length-1;
test("PAP-1847 keeps exactly one semantic Nickname property in same Full Detail section",()=>{
 assert.equal(fields.filter(field=>field.key==="nickname").length,1);
 assert.equal(sections.flatMap(section=>[...section.fields]).filter(key=>key==="nickname").length,1);
 const html=renderToStaticMarkup(createElement(PropertySections,{
   variant:"detail",fields,record,sections,
   canEdit:field=>field.key==="nickname",
   onEdit:()=>{},
 }));
 assert.equal(count(html,'data-detail-edit="nickname"'),1);
 assert.equal(count(html,"Nickname Avatar"),2); // one key label, one button aria-label
 assert.equal(count(html,'id="popover"'),0); // only mounted upon native editor selection
});
test("PAP-1847 denied viewer has readonly Nickname once and no Edit trigger",()=>{
 const html=renderToStaticMarkup(createElement(PropertySections,{
  variant:"detail",fields,record,sections,canEdit:()=>false,onEdit:()=>{},
 }));
 assert.equal(count(html,'data-detail-edit="nickname"'),0);
 assert.equal(count(html,"Nickname Avatar"),2); // one key label, one readonly aria-label
});
