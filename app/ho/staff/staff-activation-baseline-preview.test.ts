import test from "node:test";
import assert from "node:assert/strict";
import {activationPersonReader,activationRateProvider,fixturePerson} from "./staff-activation-baseline-preview";
import {createInactiveFixture,newActivationPreview} from "./staff-activation-preview";
import type {BusinessFormRequest} from "@/app/components/workspace-renderer/Slots";
test("exact synthetic Person selection and single linkage",async()=>{
 let state=newActivationPreview("local");const reader=activationPersonReader(()=>state.records.some(r=>r.existingPersonId===fixturePerson.id));
 assert.deepEqual((await reader.search("mẫu")).options,[fixturePerson]);assert.deepEqual(await reader.select(fixturePerson.id),fixturePerson);await assert.rejects(reader.select("foreign"));
 const command={name:"QA",phone:"0900000002",email:"qa@example.invalid",gender:null,birthDate:null,centerId:"m1-staff-center",login:null,existingPersonId:fixturePerson.id};
 state=createInactiveFixture(state,command);assert.equal(state.records[1]!.existingPersonId,fixturePerson.id);assert.equal(state.records[1]!.loginEmail,null);assert.deepEqual((await reader.search("mẫu")).options,[]);await assert.rejects(reader.select(fixturePerson.id));assert.throws(()=>createInactiveFixture(state,{...command,phone:"0900000003"}));assert.throws(()=>createInactiveFixture(state,{...command,phone:"0900000003",existingPersonId:"foreign"}));
});
test("Rate form isolates exact subject and principal, validates and reads back only fixture",async()=>{
 const id="STAFF-MOCK-001",p=activationRateProvider("local",x=>x===id),signal=new AbortController().signal;
 const r:BusinessFormRequest={surface:"HO",moduleKey:"staffs",slotId:"staff-rate",sourceAdapter:"salary.staff-rate",recordId:id,subject:{type:"staffs",id},principalId:"local",context:{surface:"HO",authorize:()=>true}};
 const data=await p.load(r,signal);assert.equal(data.status,"authorized");if(data.status==="authorized")assert.equal(data.records?.rows.length,0);
 assert.deepEqual(await p.load({...r,principalId:"foreign"},signal),{status:"denied"});
 assert.deepEqual(await p.submit({...r,recordId:"STAFF-MOCK-999",subject:{type:"staffs",id:"STAFF-MOCK-999"}},{amount:32000,effectiveDate:"2026-11-27",reason:"M1"},signal),{status:"denied"});
 const values={amount:32000,effectiveDate:"2026-11-27",reason:"M1"};assert.equal((await p.submit(r,values,signal)).status,"saved");assert.deepEqual(await p.submit(r,values,signal),{status:"invalid",fields:["effectiveDate"]});
 const after=await p.load(r,signal);if(after.status!=="authorized")throw Error("Missing fixture");assert.equal(after.records?.rows.length,1);assert.equal(after.records?.rows[0]?.values.reason,"M1");
 const fresh=await activationRateProvider("local",x=>x===id).load(r,signal);if(fresh.status!=="authorized")throw Error("Missing fixture");assert.equal(fresh.records?.rows.length,0);
});
