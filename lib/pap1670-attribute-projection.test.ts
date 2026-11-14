import { test } from "node:test";
import assert from "node:assert/strict";
import { projectAttribute,projectAttributeRows,type AttributeFieldProjection } from "./custom-attribute-projection";
const base:AttributeFieldProjection={id:"def",label:"Thuộc tính",valueType:"text",options:["One","Two"],value:null,writable:true,required:false};
const p=(valueType:AttributeFieldProjection["valueType"],value:unknown,writable=true)=>projectAttribute({...base,valueType,value,writable});
test("PAP-1670 absent values never become select defaults, false or zero",()=>{
 assert.equal(p("select",null).value,null);assert.equal(p("boolean",undefined).value,null);
 assert.equal(p("boolean",false).value,false);assert.equal(p("number",0).value,0);
 assert.equal(p("number",-1.25).value,-1.25);
});
test("PAP-1670 typed DSA projections and fail-closed edit admission",()=>{
 assert.equal(p("select","One").field.type,"select");assert.equal(p("select","One").canEdit,true);
 assert.equal(p("select","One",false).canEdit,false);
 assert.deepEqual(p("multiselect",["One","Two"]).value,["One","Two"]);
 assert.equal(p("date","2024-02-29").value,"2024-02-29");
 assert.equal(p("datetime","2026-11-14T20:00:00+07:00").canEdit,false);
 assert.equal(p("json",{a:1}).field.type,"textarea");assert.equal(p("json",{a:1}).value,'{"a":1}');
 assert.equal(p("number",1).canEdit,false);assert.equal(p("json",{a:1}).canEdit,false);
});
test("PAP-1670 malformed data is not coerced or offered for edit",()=>{
 for(const [t,v] of [["number","1"],["boolean","false"],["date","2026-02-30"],["datetime","2026-11-14T20:00:00"],["select","Unknown"],["multiselect",["One","One"]],["json",[]],["text","界".repeat(3000)]] as const){
  const x=p(t,v);assert.equal(x.invalid,true);assert.equal(x.canEdit,false);assert.equal(x.value,null);
 }
});
test("PAP-1670 isolated key namespace and duplicate definitions rejected",()=>{
 const a=projectAttributeRows([{...base,id:"name",value:"x"},{...base,id:"id",value:"y",writable:false}]);
 assert.equal(a.record.name,"");assert.equal(a.record.id,"");assert.equal(a.record["attribute:name"],"x");
 assert.deepEqual([...a.editable],["attribute:name"]);assert.throws(()=>projectAttributeRows([base,base]));
});
