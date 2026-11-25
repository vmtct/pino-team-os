import {test} from "node:test";
import assert from "node:assert/strict";
import {LeadRecoveryJournal} from "../app/bo/sales/leads/lead-recovery-journal";
import type {LeadCommand} from "../app/bo/sales/leads/lead-household-provider";
const scope="01a03c6e-cc58-7d81-ac8e-123456789abc",other="01a03c6e-cc58-7d81-ac8e-123456789abd",key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",target="01a03c6e-cc58-7d81-ac8e-123456789abe";
function store(){let raw:string|null=null;return {getItem:()=>raw,setItem:(_slot:string,value:string)=>{raw=value;},removeItem:()=>{raw=null;}};}
const command:LeadCommand={kind:"contact",leadId:target,expectedVersion:3,contact:{phone:"0901234567",contactDisplayName:"Private Example"}};
test("PAP-2288 reload journal retains opaque metadata only, unknown blocks new command",()=>{
 const s=store(),j=new LeadRecoveryJournal(s,scope);j.begin(command,key);
 assert.ok(!s.getItem()?.includes("0901234567"));assert.ok(!s.getItem()?.includes("Private Example"));assert.ok(!s.getItem()?.includes("contactDisplayName"));
 const recovered=new LeadRecoveryJournal(s,scope);assert.equal(recovered.inspect().state,"unknown");
 assert.throws(()=>recovered.begin(command,key));assert.throws(()=>recovered.completeReadback(key,{id:target,version:4}));
 assert.equal(new LeadRecoveryJournal(s,other).inspect().state,"blocked");
});
test("PAP-2288 known receipt restores readback only, validates exact target and version",()=>{
 const s=store(),j=new LeadRecoveryJournal(s,scope);j.begin(command,key);
 assert.throws(()=>j.acceptReceipt(key,{leadId:other,version:4}));assert.throws(()=>j.acceptReceipt(key,{leadId:target,version:5}));
 j.acceptReceipt(key,{leadId:target,version:4});
 const recovered=new LeadRecoveryJournal(s,scope);assert.equal(recovered.inspect().state,"readback");
 assert.throws(()=>recovered.completeReadback(key,{id:target,version:3}));assert.throws(()=>recovered.completeReadback(key,{id:other,version:4}));
 recovered.completeReadback(key,{id:target,version:5});assert.equal(recovered.inspect().state,"empty");
});
test("PAP-2288 create uncertain has no target or personal data, receipt is explicit",()=>{
 const s=store(),j=new LeadRecoveryJournal(s,scope);
 j.begin({kind:"create",input:{contact:{phone:"0901234567",contactDisplayName:"Private Example"}}},key);
 assert.ok(!s.getItem()?.includes("Private Example"));assert.equal(j.inspect().state,"unknown");
 j.acceptReceipt(key,{leadId:target,version:1});j.completeReadback(key,{id:target,version:1});assert.equal(j.inspect().state,"empty");
});
test("PAP-2288 corrupt scope or storage errors fail closed",()=>{
 const s=store(),j=new LeadRecoveryJournal(s,scope);
 s.setItem("","not-json");assert.equal(j.inspect().state,"blocked");assert.throws(()=>j.begin(command,key));
 const broken=new LeadRecoveryJournal({...store(),setItem:()=>{throw Error("quota");}},scope);assert.throws(()=>broken.begin(command,key));
 const silent=new LeadRecoveryJournal({...store(),setItem:()=>{}},scope);assert.throws(()=>silent.begin(command,key));
});
test("PAP-2288 authoritative initial rejection clears only exact pending key",()=>{
 const s=store(),j=new LeadRecoveryJournal(s,scope);j.begin(command,key);assert.throws(()=>j.rejectInitial(other));j.rejectInitial(key);assert.equal(j.inspect().state,"empty");
});
