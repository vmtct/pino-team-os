import test from "node:test";
import assert from "node:assert/strict";
import {parseAttributePage, attributeValueUrl, attributeValueCommand, parseAttributeReceipt, verifyAttributeReadback} from "./bo-custom-attribute-client";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5", id="01a1909d-9a99-727e-bc0f-442c8d0d1898", def="01a1e1a0-0000-7000-8000-000000000001";
const row={definitionId:def,displayName:"QA",attributeKey:"qa_bool",entityType:"Student",valueType:"boolean",scope:"CENTER",centerId:center,visibility:["BO"],options:[],required:false,status:"ACTIVE",definitionRevision:2,valueId:id,valueRevision:3,value:false,writable:true,updatedAt:"2026-11-16T10:00:00Z"};
const input=(items:unknown[],scopeCenterId=center,nextAfterDefinitionId:unknown=null)=>({data:{items,scopeCenterId,nextAfterDefinitionId}});
test("PAP-1671 client maps server admitted values and exact Center path",()=>{
 const page=parseAttributePage(input([row]),"Student",center);
 assert.equal(page.items[0]?.value,false);assert.equal(page.items[0]?.writable,true);
 assert.equal(attributeValueUrl("Student",id,center),"/api/bo/students/"+id+"/custom-attributes?centerId="+center+"&limit=100");
 assert.equal(attributeValueUrl("Parent",id,center,def),"/api/bo/identity/parents/"+id+"/custom-attributes/"+def+"?centerId="+center);
 assert.deepEqual(attributeValueCommand(page.items[0]!,true),{expectedDefinitionRevision:2,expectedValueRevision:3,value:true});
});
test("PAP-1671 denies foreign scope, duplicate definitions, missing revisions and invalid lifecycle",()=>{
 for(const raw of [input([row],id),input([{...row,centerId:id}]),input([{...row,entityType:"Parent"}]),input([row,row]),input([{...row,valueRevision:-1}]),input([{...row,status:"DRAFT"}]),input([{...row,status:"ARCHIVED"}]),input([{...row,visibility:["HO"]}]),input([row],center,id)])assert.throws(()=>parseAttributePage(raw,"Student",center));
 assert.throws(()=>attributeValueUrl("Student","bad",center));assert.throws(()=>attributeValueUrl("Parent",id,"GLOBAL"));
});
test("PAP-1671 absent and historical values preserve revision and read-only",()=>{
 const page=parseAttributePage(input([{...row,valueId:null,valueRevision:0,value:null,updatedAt:null}]),"Student",center);
 assert.equal(page.items[0]?.value,null);assert.equal(page.items[0]?.valueRevision,0);
 const historic=parseAttributePage(input([{...row,status:"ARCHIVED",writable:false}]),"Student",center);
 assert.throws(()=>attributeValueCommand(historic.items[0]!,true));
 assert.throws(()=>attributeValueCommand(page.items[0]!,null));
});
test("PAP-1671 receipt requires exact CAS successor and immutable audit id",()=>{
 const item=parseAttributePage(input([row]),"Student",center).items[0]!;
 const receipt={data:{valueId:id,revision:4,definitionRevision:2,auditEventId:def}};
 assert.equal(parseAttributeReceipt(receipt,item).revision,4);
 for(const raw of [{data:{...receipt.data,revision:3}},{data:{...receipt.data,definitionRevision:3}},{data:{...receipt.data,auditEventId:"bad"}},{data:{...receipt.data,valueId:def}}])assert.throws(()=>parseAttributeReceipt(raw,item));
});
test("PAP-1671 confirmed write requires exact persisted value and revisions",()=>{
 const target=parseAttributePage(input([row]),"Student",center).items[0]!;
 const receipt=parseAttributeReceipt({data:{valueId:id,revision:4,definitionRevision:2,auditEventId:def}},target);
 const actual={...target,valueRevision:4,value:true};
 assert.doesNotThrow(()=>verifyAttributeReadback([actual],target,receipt,true));
 assert.doesNotThrow(()=>verifyAttributeReadback([{...actual,value:{a:1,b:[false,0]}}],target,receipt,{b:[false,0],a:1}));
 for(const value of [false,null,0,"true"])assert.throws(()=>verifyAttributeReadback([{...actual,value}],target,receipt,true));
 assert.throws(()=>verifyAttributeReadback([{...actual,valueRevision:5}],target,receipt,true));
 assert.throws(()=>verifyAttributeReadback([],target,receipt,true));
});