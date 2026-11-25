import {test} from "node:test";
import assert from "node:assert/strict";
import type {LeadDetail} from "./bo-lead-household-client";
import {leadReadRow,leadReadDetail,leadAuditTime} from "../app/bo/sales/leads/lead-household-read-presentation";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc",memberId="01a03c6e-cc58-7d81-ac8e-123456789abd";
const detail:LeadDetail={id,phone:"0900000000",contactDisplayName:null,status:"ACTIVE",primaryContactMemberId:null,version:1,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:01:00Z",createdBy:memberId,updatedBy:null,centerId:null,memberCount:1,intentCount:2,members:[{id:memberId,status:"ACTIVE",version:1,displayName:"Synthetic",intendedRoles:["PARENT","GUEST"],gender:null,birthPrecision:"YEAR",birthYear:2018,birthMonth:null,birthDay:null,reportedAge:null,ageObservedAt:null,interestKinds:["MYTIME_PIANO"]}],relationships:[],intents:[],intentHistoryHasMore:true};
test("PAP-2288 list projection retains counts without fabricated detail or identity",()=>{
 const row=leadReadRow(detail);assert.equal(row.fixture,false);assert.equal(row.memberCount,1);assert.equal(row.intentCount,2);assert.equal(row.contactName,"—");assert.equal(row.createdBy,null);assert.deepEqual(row.members,[]);assert.deepEqual(row.intents,[]);
});
test("PAP-2288 detail projection keeps declared interests distinct and preserves unknown age",()=>{
 const row=leadReadDetail(detail);assert.deepEqual(row.interestKinds,["MYTIME_PIANO"]);assert.deepEqual(row.members[0]?.roles,["PARENT","GUEST"]);assert.equal(row.members[0]?.age,null);assert.equal(row.members[0]?.primaryContact,false);assert.deepEqual(row.intents,[]);
 assert.equal(leadAuditTime(detail.createdAt),"25/11/2026 · 07:00");assert.equal(leadAuditTime(null),"—");
});
