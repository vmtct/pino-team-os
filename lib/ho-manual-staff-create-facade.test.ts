// PAP-2358 · WFM-STAFF. No real login or write.
import test from "node:test";
import assert from "node:assert/strict";
import { parseHoManualStaffCommand, parseHoManualStaffReceipt } from "./ho-manual-staff-create-facade";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const command={name:" Synthetic Staff ",phone:"0912345678",email:"Staff@Example.invalid",gender:null,birthDate:null,centerId:id(1),login:null};
test("record only command is normalized without login",()=>{
 assert.deepEqual(parseHoManualStaffCommand(command),{...command,name:"Synthetic Staff",email:"staff@example.invalid"});
});
test("optional login is bound to primary email and password policy",()=>{
 const login={email:"STAFF@example.invalid",password:"synthetic-password"};
 assert.deepEqual(parseHoManualStaffCommand({...command,login})?.login,{...login,email:"staff@example.invalid"});
 for(const value of [{...login,email:"other@example.invalid"},{...login,password:"short"},{...login,roleId:id(5)},{}])
  assert.equal(parseHoManualStaffCommand({...command,login:value}),null);
});
test("strict shape rejects role, scope, identity, malformed center and invalid date",()=>{
 for(const value of [null,[],{}, {...command,roleId:id(2)}, {...command,scope:"GLOBAL"}, {...command,existingPersonId:id(3)},
  {...command,status:"active"}, {...command,centerId:"forged"}, {...command,birthDate:"2026-02-30"}, {...command,phone:"bad"}])
  assert.equal(parseHoManualStaffCommand(value),null);
});
const receipt={staffMemberId:id(2),personId:id(3),membershipId:id(4),centerId:id(1),accessState:"NOT_PROVISIONED"};
test("record-only receipt projects exact canonical references",()=>{
 assert.deepEqual(parseHoManualStaffReceipt({data:receipt},id(1),false),receipt);
 for(const value of [{...receipt,centerId:id(9)},{...receipt,password:"synthetic"},{...receipt,accessUserId:id(5)}, {...receipt,staffMemberId:"fake"}])
  assert.equal(parseHoManualStaffReceipt({data:value},id(1),false),null);
});
test("opt-in receipt requires both account IDs and matching branch",()=>{
 const account={...receipt,accessState:"PROVISIONED",accessUserId:id(5),assignmentId:id(6)};
 assert.deepEqual(parseHoManualStaffReceipt({data:account},id(1),true),account);
 assert.equal(parseHoManualStaffReceipt({data:account},id(1),false),null);
 assert.equal(parseHoManualStaffReceipt({data:receipt},id(1),true),null);
 assert.equal(parseHoManualStaffReceipt({data:{...account,assignmentId:null}},id(1),true),null);
});
