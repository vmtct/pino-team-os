// PAP-2358 · WFM-STAFF. Synthetic transport only.
import test from "node:test";
import assert from "node:assert/strict";
import {createHoManualStaff} from "./ho-manual-staff-create-client";
import type {StaffCreateCommand} from "../app/ho/staff/manual-create-contract";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const command:StaffCreateCommand={name:"Synthetic",phone:"0912345678",email:"qa@example.invalid",gender:null,birthDate:null,centerId:id(1),login:null};
const receipt={staffMemberId:id(2),personId:id(3),membershipId:id(4),centerId:id(1),initialStaffStatus:"inactive" as const,accessState:"NOT_PROVISIONED"};
test("exact same-origin request and caller-owned key",async()=>{
 let count=0;const fetcher:typeof fetch=async(url,init)=>{
  count++;assert.equal(url,"/api/ho/staff/create");assert.equal(init?.method,"POST");assert.equal(init?.credentials,"same-origin");assert.equal(init?.redirect,"error");
  assert.equal(new Headers(init?.headers).get("idempotency-key"),"qa-operation-key");assert.equal(new Headers(init?.headers).get("x-pino-expected-staff-principal"),"qa-founder");const {login,...record}=command;assert.equal(login,null);assert.deepEqual(JSON.parse(String(init?.body)),record);
  return Response.json({data:receipt},{status:201});
 };
 assert.deepEqual(await createHoManualStaff(command,"qa-operation-key",{principalId:"qa-founder",fetcher}),receipt);
 assert.equal(count,1);
});
test("uncertain network or receipt mismatch does not retry or leak payload",async()=>{
 let count=0;const fetcher:typeof fetch=async()=>{count++;throw new Error("synthetic-sensitive-detail");};
 await assert.rejects(createHoManualStaff(command,"qa-operation-key",{principalId:"qa-founder",fetcher}),{kind:"uncertain",status:null,message:"Manual Staff creation uncertain"});
 assert.equal(count,1);
 await assert.rejects(createHoManualStaff(command,"qa-operation-key",{principalId:"qa-founder",fetcher:async()=>Response.json({data:{...receipt,centerId:id(9)}},{status:201})}),{kind:"uncertain",status:502});
});
test("stable error classification and invalid key never calls fetch",async()=>{
 for(const [status,kind] of [[400,"invalid"],[403,"denied"],[409,"conflict"],[503,"uncertain"]] as const)
  await assert.rejects(createHoManualStaff(command,"qa-operation-key",{principalId:"qa-founder",fetcher:async()=>Response.json({error:{message:"synthetic-sensitive-detail"}},{status})}),{kind,status});
 await assert.rejects(createHoManualStaff(command,"short",{principalId:"qa-founder",fetcher:async()=>{throw new Error("unexpected fetch");}}),{kind:"invalid",status:400});
});
test("phase1 rejects opt-in before fetch and historical or provisioned receipt after response",async()=>{
 const login={...command,login:{email:command.email,password:"synthetic-password"}};
 await assert.rejects(createHoManualStaff(login,"qa-operation-key",{principalId:"qa-founder",fetcher:async()=>{throw Error("unexpected fetch");}}),{kind:"invalid",status:400});
 for(const value of [{...receipt,initialStaffStatus:null},{...receipt,initialStaffStatus:"active"},{...receipt,accessState:"PROVISIONED",accessUserId:id(5),assignmentId:id(6)}])
  await assert.rejects(createHoManualStaff(command,"qa-operation-key",{principalId:"qa-founder",fetcher:async()=>Response.json({data:value},{status:201})}),{kind:"uncertain",status:502});
});
