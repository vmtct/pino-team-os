import test from "node:test";
import assert from "node:assert/strict";
import {prodCounts,protoRows,protoAuditRows} from "./ho-proto-fixtures";
import {protoRoutes,protoModules} from "./ho-proto-a23";

test("Production aggregate counts exactly match dated read-only D1 query",()=>{
 for(const [key,count] of Object.entries({
  centers:2,users:17,roles:7,syllabi:0,missions:0,worlds:1,
  wardrobe:25,wardrobeSets:3,activities:0,cms:0,wishBanners:0,wishRules:1
 }))assert.equal(prodCounts[key as keyof typeof prodCounts],count,key);
 assert.equal(protoAuditRows.length,266);
 for(const key of ["centers","users","roles","syllabi","missions","worlds","wardrobe","wardrobeSets","activities","cms"]){
  assert.equal(protoRows(key,"production").length,prodCounts[key as keyof typeof prodCounts],key);
 }
});
test("Synthetic baseline preserves production status distribution",()=>{
 const count=(key:string,status:string)=>protoRows(key,"production").filter(x=>x.status===status).length;
 assert.equal(count("wardrobe","ACTIVE"),21);
 assert.equal(count("wardrobe","DRAFT"),4);
 assert.equal(count("wardrobeSets","DRAFT"),2);
 assert.equal(count("wardrobeSets","ARCHIVED"),1);
 assert.equal(count("roles","archived"),1);
 assert.equal(count("worlds","DRAFT"),1);
});
test("A2/A3 demo covers scopes, overrides, multisite CMS, Wish and Activities",()=>{
 const tv=protoRows("tvPolicy","demo");
 assert.equal(tv.length,3);
 assert.deepEqual(tv.map(x=>x.resolution),["ACTIVE · DEFAULT","Override","Inherited DEFAULT"]);
 const cms=protoRows("cms","demo");
 assert.equal(new Set(cms.map(x=>x.site)).size,3);
 assert.equal(cms.length,9);
 const wish=protoRows("wish","demo");
 assert.ok(wish.some(x=>x.kind==="RULE")&&wish.some(x=>x.kind==="BANNER")&&wish.some(x=>x.kind==="RELEASE_PHASE"));
 const activities=protoRows("activities","demo");
 assert.equal(activities.length,6);
 assert.ok(activities.some(x=>x.center==="GLOBAL")&&activities.some(x=>x.center!=="GLOBAL"));
});
test("Presentation uses canonical module field schema and deterministic synthetic records",()=>{
 assert.equal(Object.keys(protoRoutes).length,4);
 for(const [key,module] of Object.entries(protoModules)){
  assert.ok(module.fields.length>=9,key);
  assert.ok(module.fields.every(x=>x.readonly),key);
  assert.ok(protoRows(key,"demo").every(x=>typeof x.id==="string"&&typeof x.name==="string"));
 }
 assert.ok(protoRows("users","demo").every(x=>String(x.name).endsWith("@example.invalid")));
 assert.equal(JSON.stringify(protoAuditRows).includes("payload"),false);
 for(const key of ["syllabi","missions","worlds","wardrobe","wardrobeSets","effects","tvPolicy","cms","wish","activities"]){
  assert.deepEqual(protoRows(key,"demo"),protoRows(key,"demo"),key);
 }
});
