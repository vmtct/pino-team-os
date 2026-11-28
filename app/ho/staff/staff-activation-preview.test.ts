import test from "node:test";
import assert from "node:assert/strict";
import {activateFixture,createInactiveFixture,fixtureSubject,newActivationPreview} from "./staff-activation-preview";
import {activationRequest,verifiedActivation} from "./staff-activation-model";
test("same fixture record transitions inactive to active without account or audit",()=>{
 const state=newActivationPreview("local"),id=state.records[0]!.id,subject=fixtureSubject(state,id)!;
 const request=activationRequest(subject)!;const next=activateFixture(state,request);
 assert.equal(next.result.kind,"activated");
 if(next.result.kind==="activated")assert.equal(verifiedActivation(request,next.result.subject),true);
 assert.equal(next.state.records[0]!.id,id);assert.equal(next.state.records[0]!.role,null);assert.equal(next.state.records[0]!.loginEmail,null);assert.equal(next.state.records[0]!.updatedAt,null);
 assert.equal(activateFixture(next.state,request).result.kind,"stale");assert.equal(state.records[0]!.status,"Ngưng");
});
test("fixture creation remains inactive record only and denies login",()=>{
 const state=newActivationPreview("local"),command={name:"QA",phone:"0900000002",email:"qa@example.invalid",gender:null,birthDate:null,centerId:"m1-staff-center",login:null};
 const next=createInactiveFixture(state,command);assert.equal(next.records[1]!.status,"Ngưng");assert.equal(next.records[1]!.loginEmail,null);
 assert.throws(()=>createInactiveFixture(state,{...command,login:{email:command.email,password:"fixture"}}));
});
