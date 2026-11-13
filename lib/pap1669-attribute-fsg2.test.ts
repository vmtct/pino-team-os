/** PAP-1669 / Epic PAP-1665 PLT-ATTR — shared Create/View field + boundary guards. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attributeModule, asRecord, draft, draftRecord, editDraft, validate, type AttributeDefinition } from "./ho-attribute-model";
import { hoAttributeDefinitions } from "./ho-attribute-definitions-facade";
import { decideHostBoundary } from "./host-boundary";

const centers=[{id:"019d1000-0001-7000-8000-000000000002",label:"PINO Cần Thơ"}];
test("G0/PINO DSA exact 14 fields and original shared Drawer renderer",()=>{
 assert.deepEqual(attributeModule.fields.map(f=>f.key),[
  "displayName","attributeKey","entityType","valueType","scope","center",
  "lifecycleState","required","visibility","revision","createdAt","createdByUser",
  "updatedAt","updatedByUser"
 ]);
 const quick=readFileSync("app/bo/components/registration/BoQuickView.tsx","utf8");
 const ho=readFileSync("app/ho/system/custom-attributes/page.tsx","utf8");
 assert.match(quick,/<PropertySections/);
 assert.match(quick,/create\?\.draft/);
 assert.match(ho,/<BoQuickView/);
 assert.doesNotMatch(ho,/<DrawerFrame|ConfigFields|<form/i);
 assert.match(ho,/Core readback|xác minh Core readback/);
});
test("Draft restricts Center, typed options, visibility and canonical key",()=>{
 const a=draft();
 assert.equal(a.scope,"GLOBAL");assert.equal(validate(a,centers),"Nhập tên thuộc tính từ 1–120 ký tự.");
 const b=editDraft({...a,displayName:"Nguồn giới thiệu",attributeKey:"referral_source"},"scope","CENTER",centers);
 assert.equal(b.centerId,centers[0].id);
 assert.equal(validate(b,centers),null);
 const c=editDraft(b,"valueType","select",centers);
 assert.match(validate(c,centers)??"",/Select/);
 const e=editDraft(c,"options","Zalo\nFacebook",centers);
 assert.deepEqual(e.options,["Zalo","Facebook"]);assert.equal(validate(e,centers),null);
 const f=editDraft(e,"scope","GLOBAL",centers);
 assert.equal(f.centerId,null);
});
test("View only exposes Core data; never invent audit actor names",()=>{
 const data:AttributeDefinition={...draft(),displayName:"Nguồn",attributeKey:"referral_source",
  id:"019d1000-0001-7000-8000-000000000001",status:"DRAFT",revision:1,
  createdAt:"2026-11-09T06:00:00.000Z",updatedAt:"2026-11-09T06:00:00.000Z",
  createdByUserId:"opaque-actor-1",updatedByUserId:"opaque-actor-1"};
 const row=asRecord(data,centers);
 assert.equal(row.createdByUser,"—");assert.equal(row.updatedByUser,"—");
 assert.match(String(row.createdAt),/09\/11\/2026/);
 assert.equal(draftRecord(draft(),centers).lifecycleState,"DRAFT");
});
test("HO route rejects untrusted host, cross-host POST and unsupported query before Core",async()=>{
 const env={APP_ENV:"staging"} as Parameters<typeof hoAttributeDefinitions>[1];
 const make=(url:string,method="GET",headers:Record<string,string>={})=>
  new Request(url,{method,headers,body:method==="POST"?"{}":undefined});
 assert.equal((await hoAttributeDefinitions(make("https://attacker.invalid/api/ho/custom-attributes/definitions"),env)).status,404);
 assert.equal((await hoAttributeDefinitions(make("https://ho.staging.pinohouse.art/api/ho/custom-attributes/definitions?evil=1","GET",{host:"ho.staging.pinohouse.art"}),env)).status,400);
 assert.equal((await hoAttributeDefinitions(make("https://ho.staging.pinohouse.art/api/ho/custom-attributes/definitions","POST",{host:"ho.staging.pinohouse.art","content-type":"application/json","idempotency-key":"PAP1669-fsg2-test"}),env)).status,403);
});

test("PAP-1669 exact host+verb matrix denies BO/TOS/Prod and unrelated HO writes",()=>{
 const root="/api/ho/custom-attributes/definitions";
 const detail=root+"/019d1000-0001-7000-8000-000000000001";
 const ho="ho.staging.pinohouse.art";
 for(const method of ["GET","POST"])assert.deepEqual(decideHostBoundary(ho,root,method),{action:"next"});
 assert.deepEqual(decideHostBoundary(ho,detail,"GET"),{action:"next"});
 for(const method of ["PUT","PATCH","DELETE"])assert.deepEqual(decideHostBoundary(ho,root,method),{action:"not_found"});
 for(const method of ["POST","PUT","DELETE"])assert.deepEqual(decideHostBoundary(ho,detail,method),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(ho,detail,"PATCH"),{action:"next"}); // PAP-1905 authorized metadata-only
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","pinohouse.art"]){
  for(const method of ["GET","POST"])assert.deepEqual(decideHostBoundary(host,root,method),{action:"not_found"});
 }
 assert.deepEqual(decideHostBoundary(ho,root+"/019d1000-0001-4000-8000-000000000001","GET"),{action:"not_found"});
});
