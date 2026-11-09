import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {itemDefinition,itemFields,itemQuery,projectItemRow,formatItemAuditTime} from "../app/ho/pinoria/wardrobe/schema";
import type {ItemRecord} from "../app/ho/pinoria/wardrobe/item-client";

const audit=["createdAt","createdBy","updatedAt","updatedBy"] as const;
const item:ItemRecord={
 id:"019b1126-0001-7000-8000-000000000001",key:"pap1700-item",displayName:"PAP1700 QA",type:"WEARABLE",
 slot:"HEADWEAR",status:"DRAFT",revision:1,asset:{key:"pinoria/item/uploads/qa",mimeType:"image/png",byteSize:6,sha256:"a".repeat(64)},
 positionX:0,positionY:0,scale:1,rotationDegrees:null,variantOfItemId:null,
 createdAt:"2026-11-08T09:30:00.000Z",updatedAt:"2026-11-08T09:42:00+00:00",
 publishedAt:null,unpublishedAt:null
};
test("PAP-1700 FSG0 has exactly four audit fields default-on in Table, Quick Drawer and Detail",()=>{
 const keys=itemFields.map(f=>f.key);
 const expected=["createdAt","createdBy","updatedAt","updatedBy"];
 assert.deepEqual(keys.slice(-4),expected);
 for(const k of audit){
  assert.ok(itemQuery.order.includes(k));
  assert.ok(itemQuery.visible.includes(k));
  assert.ok(itemDefinition.table.columns.some(c=>c.field===k&&c.visible));
  assert.ok(itemDefinition.drawer.sections.some(s=>(s.fields as readonly string[]).includes(k)));
  assert.ok(itemDefinition.detail.overview.sections.some(s=>(s.fields as readonly string[]).includes(k)));
  assert.equal(itemFields.find(f=>f.key===k)?.permission,"pinoria.item.view");
  assert.equal(itemFields.find(f=>f.key===k)?.readOnly,true);
 }
});
test("PAP-1700 real timestamps are Ho Chi Minh wall-clock, missing timestamps are not forged",()=>{
 assert.equal(formatItemAuditTime("2026-11-08T09:30:00Z"),"08/11/2026 · 16:30");
 assert.equal(formatItemAuditTime("2026-11-08T09:42:00+00:00"),"08/11/2026 · 16:42");
 for(const x of ["",null,undefined,"2026-11-08","November 8 2026","bad time"]){
  assert.equal(formatItemAuditTime(x),"—");
 }
 const row=projectItemRow(item);
 assert.equal(row.createdAt,"08/11/2026 · 16:30");
 assert.equal(row.updatedAt,"08/11/2026 · 16:42");
 assert.equal(row.createdBy,"—");
 assert.equal(row.updatedBy,"—");
 const legacy=projectItemRow({...item,createdAt:"",updatedAt:""});
 assert.equal(legacy.createdAt,"—");
 assert.equal(legacy.updatedAt,"—");
});
test("PAP-1700 Drawer uses canonical shared shell, guards writes and preserves existing Core Item POST/SET",()=>{
 const source=readFileSync(new URL("../app/ho/pinoria/wardrobe/HoItemCreate.tsx",import.meta.url),"utf8");
 const host=readFileSync(new URL("../app/ho/pinoria/wardrobe/HoItemsTdd.tsx",import.meta.url),"utf8");
 assert.match(source,/import \{DrawerFrame\} from "@\/app\/components\/workspace-renderer\/DrawerFrame"/);
 assert.match(source,/<DrawerFrame title="Tạo Item"/);
 assert.match(source,/if\(busy\)return/);
 assert.match(source,/kind!=="SET"&&\(!file/);
 assert.match(source,/uploadItem\(file\)/);
 assert.match(source,/await writeItem\("","POST"/);
 assert.match(source,/starterEligible:false,memberItemIds:\[\]/);
 assert.match(source,/aria-label="Tạo Item"/);
 assert.doesNotMatch(source,/pino-item-create-form" aria-label="Tạo Item".*hidden/);
 assert.match(host,/authorize\("pinoria.item.manage"\)/);
 assert.match(host,/<SurfaceWorkspace/);
});
