/** PAP-1841 / Epic PAP-1665 PLT-ATTR — FSG3 HO table server query contract. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attributeModule } from "./ho-attribute-model";
import {
  encodeAttributeDirectoryQuery,validateAttributeDirectoryParams,parseAttributePage,
  ATTRIBUTE_SORTS,type AttributeTableRequest
} from "./pap1841-attribute-directory-query";

const center="019d1000-0001-7000-8000-000000000002";
const base:AttributeTableRequest={limit:15,offset:0,sort:"createdAt",order:"desc"};
test("PAP-1841: 14 source-authorized G0 table columns, no visible opaque UUID",()=>{
 assert.deepEqual(attributeModule.fields.map(f=>f.key),[
  "displayName","attributeKey","entityType","valueType","scope","center",
  "lifecycleState","required","visibility","revision","createdAt","createdByUser",
  "updatedAt","updatedByUser"
 ]);
 assert.equal(attributeModule.fields.some(f=>f.key==="id"||f.key==="createdByUserId"),false);
});
test("PAP-1841: server query contains correct 15-row page and all exact Core filters, stable sorting",()=>{
 const query=encodeAttributeDirectoryQuery({...base,offset:30,search:"Mẫu Cần Thơ",sort:"attributeKey",
  order:"asc",entityType:"Student",status:"ACTIVE",scope:"CENTER",centerId:center});
 assert.equal(query.toString(),"limit=15&offset=30&sort=attributeKey&order=asc&search=M%E1%BA%ABu+C%E1%BA%A7n+Th%C6%A1&entityType=Student&status=ACTIVE&scope=CENTER&centerId="+center);
 assert.equal(validateAttributeDirectoryParams(query),true);
 assert.equal((ATTRIBUTE_SORTS as readonly string[]).includes("createdByUser"),false);
});
test("PAP-1841: absent search/filter keys don't mutate server query; 0-current page retains real total",()=>{
 const p=encodeAttributeDirectoryQuery({...base,search:"   "});
 assert.equal(p.get("search"),null);
 const parsed=parseAttributePage({items:[],limit:15,offset:30,total:73},15,30);
 assert.equal(parsed.total,73);assert.equal(parsed.items.length,0);
 assert.throws(()=>parseAttributePage({items:[],limit:15,offset:30},15,30),/Core total/);
 assert.throws(()=>parseAttributePage({items:[],limit:15,offset:30,total:0.5},15,30),/Core total/);
});
test("PAP-1841: GET query rejects duplicates, unknown keys, invalid sorting/Center/control chars",()=>{
 for(const text of [
  "limit=10&limit=20","foo=x","sort=DROP+TABLE","order=up",
  "status=SECURE","scope=OTHER","centerId=123","search=%00",
  "limit=100","offset=10001"
 ])assert.equal(validateAttributeDirectoryParams(new URLSearchParams(text)),false,text);
 assert.equal(validateAttributeDirectoryParams(new URLSearchParams("limit=8&offset=0&search=Test")),true);
 assert.throws(()=>encodeAttributeDirectoryQuery({...base,sort:"createdByUser" as AttributeTableRequest["sort"]}),/sort/);
});
test("PAP-1841: HO FSG3 reuses canonical BoDataTable, settings and BoQuickView; no fake page counts",()=>{
 const page=readFileSync("app/ho/system/custom-attributes/page.tsx","utf8");
 assert.match(page,/<BoDataTable\b/);
 assert.match(page,/<BoTableSettings\b/);
 assert.match(page,/<BoQuickView\b/);
 assert.match(page,/serverTotal=/);
 assert.doesNotMatch(page,/Số bản ghi trong trang Core hiện tại/);
 const facade=readFileSync("lib/ho-attribute-definitions-facade.ts","utf8");
 assert.match(facade,/validateAttributeDirectoryParams/);
});

test("PAP-1841 G3 regression: exactly one canonical BoDataTable pagination footer, no duplicate IDs",()=>{
 const page=readFileSync("app/ho/system/custom-attributes/page.tsx","utf8");
 const table=readFileSync("app/bo/components/registration/BoDataTable.tsx","utf8");
 assert.match(table,/<footer className="table-footer"/);
 assert.ok(page.includes("<BoDataTable module="),"HO must reuse canonical shared BoDataTable");
 assert.doesNotMatch(page,/<footer className="table-footer"/,
  "HO must not render a second footer in addition to the canonical shared BoDataTable footer");
 assert.doesNotMatch(page, /id="page-size"/,
  "HO must not create a second page-size selector with a duplicate id");
});
