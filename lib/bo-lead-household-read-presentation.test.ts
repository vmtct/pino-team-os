import {test} from "node:test";
import assert from "node:assert/strict";
import type {LeadDetail} from "./bo-lead-household-client";
import {leadReadRow,leadReadDetail,leadAuditTime,websiteInquirySummary,websiteProgramLabel} from "../app/bo/sales/leads/lead-household-read-presentation";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc",memberId="01a03c6e-cc58-7d81-ac8e-123456789abd";
const detail:LeadDetail={id,phone:"0900000000",contactDisplayName:null,status:"ACTIVE",primaryContactMemberId:null,version:1,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:01:00Z",createdBy:memberId,updatedBy:null,centerId:null,memberCount:1,intentCount:2,members:[{id:memberId,status:"ACTIVE",version:1,displayName:"Synthetic",intendedRoles:["PARENT","GUEST"],gender:null,birthPrecision:"YEAR",birthYear:2018,birthMonth:null,birthDay:null,reportedAge:null,ageObservedAt:null,interestKinds:["MYTIME_PIANO"]}],relationships:[],intents:[],intentHistoryHasMore:true};
test("PAP-2288 list projection retains counts without fabricated detail or identity",()=>{
 const row=leadReadRow(detail);assert.equal(row.fixture,false);assert.equal(row.memberCount,1);assert.equal(row.intentCount,2);assert.equal(row.contactName,"—");assert.equal(row.createdBy,null);assert.deepEqual(row.members,[]);assert.deepEqual(row.intents,[]);
});
test("PAP-2288 detail projection keeps declared interests distinct and preserves unknown age",()=>{
 const row=leadReadDetail(detail);assert.deepEqual(row.interestKinds,["MYTIME_PIANO"]);assert.deepEqual(row.members[0]?.roles,["PARENT","GUEST"]);assert.equal(row.members[0]?.age,null);assert.equal(row.members[0]?.primaryContact,false);assert.deepEqual(row.intents,[]);
 assert.equal(leadAuditTime(detail.createdAt),"25/11/2026 · 07:00");assert.equal(leadAuditTime(null),"—");
});

test("PAP-2424 website submission never replaces canonical contact or member interests",()=>{
 const website={schemaVersion:1 as const,contactName:"Synthetic website",interest:{program:"AFTERSCHOOL" as const,path:"little-piner" as const,planSessions:36 as const},consent:{version:"qa-v1",acceptedAt:"2026-11-27T06:00:00.000Z"}};
 const row=leadReadDetail({...detail,contactDisplayName:"Operator",websiteSubmittedName:website.contactName,websiteProgram:"AFTERSCHOOL"});
 assert.equal(row.contactName,"Operator");assert.equal(row.websiteSubmittedName,"Synthetic website");assert.equal(row.websiteProgram,"AFTERSCHOOL");
 assert.deepEqual(row.interestKinds,["MYTIME_PIANO"]);assert.equal(row.members.length,1);assert.deepEqual(row.intents,[]);
 const baseIntent={id,kind:"PROGRAM_INTEREST" as const,sourceBrand:"PINO_HOUSE" as const,sourceSurface:"PINO_HOUSE_WEB" as const,status:"SUBMITTED" as const,createdAt:website.consent.acceptedAt,version:1};
 assert.equal(websiteInquirySummary({...baseIntent,websiteInterest:website}),"PINO Afterschool · Little Piner · 36 buổi");
 assert.equal(websiteInquirySummary({...baseIntent,websiteInterest:{...website,interest:{program:"MYTIME",activity:"piano",favoriteRef:"historical-favorite"}}}),"MyTime by PINO · Piano · Lựa chọn: historical-favorite");
 assert.equal(websiteInquirySummary(baseIntent),null);assert.equal(websiteProgramLabel(null),null);
 assert.equal(leadReadRow(detail).websiteSubmittedName,undefined);
});
