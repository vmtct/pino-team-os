// PAP-2358 · WFM-STAFF. Isolated synthetic Person discovery.
import test from "node:test";
import assert from "node:assert/strict";
import {createStaffPersonReader} from "./staff-person-reader";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const person={id:id(1),displayName:"QA Person",roles:[],avatar:{id:null,status:"SELF_MISSING",selfStatus:null,nickname:null},createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdBy:null,updatedBy:null,version:1};
const linked={...person,id:id(2),roles:[{kind:"STAFF",id:id(3),displayName:"Staff",status:"active"}]};
test("explicit lookup uses existing Person read only and filters Staff-linked candidates",async()=>{
 const calls:string[]=[];
 const reader=createStaffPersonReader(async(url,init)=>{calls.push(String(url));assert.equal(init?.method,"GET");return Response.json({data:{items:[person,linked],nextAfter:null}});});
 const result=await reader.search(" QA Person ");
 assert.deepEqual(result.options,[{id:id(1),label:"QA Person"}]);assert.equal(calls[0],"/api/ho/identity/persons?limit=100&q=QA+Person");
 await assert.rejects(reader.search(" "));assert.equal(calls.length,1);
});
test("selection re-reads exact identity, rejects linked and mismatch",async()=>{
 const read=createStaffPersonReader(async()=>Response.json({data:person}));
 assert.deepEqual(await read.select(id(1)),{id:id(1),label:"QA Person"});
 await assert.rejects(read.select(id(2)));
 await assert.rejects(createStaffPersonReader(async()=>Response.json({data:linked})).select(id(2)),/đã có Staff/);
});
