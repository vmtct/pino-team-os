import {test} from "node:test";
import assert from "node:assert/strict";
import {CONTACT_FIELD_SCHEMA,LEAD_TABLE_COLUMNS,LEAD_AUDIT_TABLE_COLUMNS,LEAD_DETAIL_TABS,leadFixtureFilterable} from "../app/bo/sales/leads/lead-presentation-schema";
test("PAP-2288 Lead native field and tab metadata preserves approved contract",()=>{
 assert.deepEqual(CONTACT_FIELD_SCHEMA,[{key:"contactName",label:"Người liên hệ"},{key:"phone",label:"Số điện thoại",required:true}]);
 assert.deepEqual(Object.values(LEAD_TABLE_COLUMNS).map(c=>c.key),["contact","phone","household","interest","source","lifecycle"]);
 assert.deepEqual(Object.values(LEAD_TABLE_COLUMNS).map(c=>c.minWidth),[210,140,170,230,150,120]);
 assert.equal(LEAD_TABLE_COLUMNS.contact.sticky,true);
 assert.deepEqual(LEAD_AUDIT_TABLE_COLUMNS.map(c=>[c.key,c.header,c.minWidth]),[["createdAt","Created Time",150],["createdBy","Created By",130],["updatedAt","Last Modified Time",150],["updatedBy","Last Modified By",130]]);
 assert.ok(LEAD_AUDIT_TABLE_COLUMNS.every(c=>c.fallback==="—"));
 assert.deepEqual(Object.values(LEAD_DETAIL_TABS).map(t=>[t.id,t.label]),[["detail","Tổng quan"],["members","Thành viên"],["relationships","Quan hệ"],["history","Lịch sử"]]);
 for(const column of [...Object.values(LEAD_TABLE_COLUMNS),...LEAD_AUDIT_TABLE_COLUMNS]){
  assert.equal(leadFixtureFilterable(column.key,false),["phone","lifecycle"].includes(column.key));
  assert.equal(leadFixtureFilterable(column.key,true),false);
 }
});
