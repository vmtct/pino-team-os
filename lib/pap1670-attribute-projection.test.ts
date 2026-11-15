import { test } from "node:test";
import assert from "node:assert/strict";
import { projectAttribute,projectAttributeRows,prepareAttributeEdit,type AttributeFieldProjection } from "./custom-attribute-projection";
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
 assert.equal(p("datetime","2026-11-14T20:00:00+07:00").canEdit,true);
 assert.equal(p("json",{a:1}).field.type,"textarea");assert.equal(p("json",{a:1}).value,'{"a":1}');
 assert.equal(p("number",1).canEdit,true);assert.equal(p("json",{a:1}).canEdit,true);
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

test("PAP-1670 native editor adapter preserves signed decimals, offset time, boolean absence and JSON",()=>{
 const n={...base,valueType:"number" as const,value:-1.25};
 const np=prepareAttributeEdit(n)!;assert.equal(np.field.type,"text");assert.equal(np.value,"-1.25");assert.deepEqual(np.parse("-1.25"),{ok:true,value:-1.25});
 assert.deepEqual(np.parse("0"),{ok:true,value:0});for(const bad of [""," ", "0x10","Infinity","1e999"])assert.equal(np.parse(bad).ok,false);
 const dt=prepareAttributeEdit({...base,valueType:"datetime",value:"2026-11-14T20:00:00+07:00"})!;
 assert.equal(dt.field.type,"text");assert.equal(dt.value,"2026-11-14T20:00:00+07:00");assert.equal(dt.parse("2026-11-14T20:00:00").ok,false);assert.equal(dt.parse(dt.value).ok,true);
 const bool=prepareAttributeEdit({...base,valueType:"boolean"})!;
 assert.equal(bool.field.type,"select");assert.equal(bool.value,null);assert.equal(bool.parse("").ok,false);assert.deepEqual(bool.parse("Không"),{ok:true,value:false});assert.deepEqual(bool.parse("Có"),{ok:true,value:true});
 const j=prepareAttributeEdit({...base,valueType:"json",value:{x:0}})!;
 assert.equal(j.field.type,"textarea");assert.deepEqual(j.parse('{"x":false}'),{ok:true,value:{x:false}});
 for(const bad of ["[]","null","{}",'{"__proto__":1}','{"constructor":1}','{"x":1e999}']) {
  if(bad==="{}")assert.equal(j.parse(bad).ok,true);else assert.equal(j.parse(bad).ok,false);
 }
 assert.equal(j.parse(JSON.stringify({x:"界".repeat(3000)})).ok,false);
});
test("PAP-1670 adapter denies unauthorized or invalid projections and never materializes implicit values",()=>{
 assert.equal(prepareAttributeEdit({...base,writable:false}),null);
 assert.equal(prepareAttributeEdit({...base,valueType:"number",value:"9"}),null);
 assert.equal(prepareAttributeEdit({...base,valueType:"json",value:new Date()}),null);
 const sparse=Array(1);Object.defineProperty(sparse,"unexpected",{value:1,enumerable:true});assert.equal(prepareAttributeEdit({...base,valueType:"json",value:{sparse}}),null);
 const required=prepareAttributeEdit({...base,required:true})!;assert.equal(required.parse("  ").ok,false);
 const multi=prepareAttributeEdit({...base,valueType:"multiselect",required:true})!;
 assert.equal(multi.parse([]).ok,false);assert.deepEqual(multi.parse(["One"]),{ok:true,value:["One"]});assert.equal(multi.parse(["One","One"]).ok,false);
 const select=prepareAttributeEdit({...base,valueType:"select"})!;assert.equal(select.parse("").ok,false);assert.equal(select.parse("Other").ok,false);
});
