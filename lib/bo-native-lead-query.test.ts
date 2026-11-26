import {test} from "node:test";
import assert from "node:assert/strict";
import {parseNativeLeadQuery} from "../app/bo/sales/leads/native-lead-query";
const lead="01a03c6e-cc58-7d81-ac8e-123456789abc",center="11111111-2222-4333-8444-555555555555";
test("PAP-2288 native list and UUIDv7 detail/drawer preserve exact navigation",()=>{
 assert.deepEqual(parseNativeLeadQuery({}),{kind:"household",centerId:null,lead:null,quickView:null,tab:null,canonical:""});
 for(const tab of ["detail","members","relationships","history"]){
  const q=parseNativeLeadQuery(new URLSearchParams({tab,lead,centerId:center}));
  assert.deepEqual(q,{kind:"household",centerId:center,lead,quickView:null,tab,canonical:"centerId="+center+"&lead="+lead+"&tab="+tab});
 }
 assert.deepEqual(parseNativeLeadQuery({quickView:lead}),{kind:"household",centerId:null,lead:null,quickView:lead,tab:null,canonical:"quickView="+lead});
});
test("PAP-2288 native selector rejects ambiguity, fixture and noncanonical IDs",()=>{
 for(const q of [{lead,quickView:lead},{lead:[lead,lead]},{lead:"LEAD-MOCK-001"},{lead:center},{lead:lead.toUpperCase()},{quickView:lead,tab:"history"},{tab:"detail"},{lead,tab:"invalid"},{lead,m1Preview:"1"},{lead,q:"0900000000"},{lead,centerId:"GLOBAL"},{lead,unknown:"1"},{lead:""}])assert.equal(parseNativeLeadQuery(q),null,JSON.stringify(q));
 assert.equal(parseNativeLeadQuery(new URLSearchParams("lead="+lead+"&lead="+lead)),null);
});
test("PAP-2288 F1 intent continuation stays distinct, never an aggregate selector",()=>{
 assert.deepEqual(parseNativeLeadQuery({leadIntent:center,centerId:center}),{kind:"legacy-intent",centerId:center,leadIntent:center,canonical:"centerId="+center+"&leadIntent="+center});
 for(const q of [{leadIntent:center,lead},{leadIntent:center,quickView:lead},{leadIntent:center,tab:"detail"},{leadIntent:"LEAD-MOCK-001"},{leadIntent:[center,center]}])assert.equal(parseNativeLeadQuery(q),null);
});
test("PAP-2288 server object and URLSearchParams agree for supported and denied queries",()=>{
 for(const q of [{lead,tab:"history"},{quickView:lead},{centerId:center},{leadIntent:center},{lead,quickView:lead},{lead,m1Preview:"1"},{lead,tab:"detail",centerId:center}]){
  const p=new URLSearchParams(Object.entries(q).filter((entry):entry is [string,string]=>typeof entry[1]==="string"));
  assert.deepEqual(parseNativeLeadQuery(q),parseNativeLeadQuery(p));
 }
});
test("PAP-2288 legacy grid hints are bounded migration input only",()=>{
 const q=parseNativeLeadQuery({leadIntent:center,centerId:center,q:"music",sort:"createdAt",dir:"desc",size:"50",f_status:"SUBMITTED"});
 assert.equal(q?.kind,"legacy-intent");
 assert.equal(q?.canonical,"centerId="+center+"&leadIntent="+center+"&q=music&sort=createdAt&dir=desc&size=50&f_status=SUBMITTED");
 for(const invalid of [{leadIntent:center,size:"101"},{leadIntent:center,dir:"wrong"},{leadIntent:center,f_status:"ACTIVE"},{leadIntent:center,q:["a","b"]},{leadIntent:center,returnTo:"//evil.example"},{lead,q:"music"}])assert.equal(parseNativeLeadQuery(invalid),null);
});
