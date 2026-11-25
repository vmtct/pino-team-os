import {test} from "node:test";
import assert from "node:assert/strict";
import {createLeadHouseholdApi,LeadApiError} from "./bo-lead-household-client";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc",key="synthetic-lead-key-123",base="/api/bo/acquisition/households";
function fixture(data:unknown,status=200){
 const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const api=createLeadHouseholdApi((url,init)=>{calls.push({url:String(url),init});return Promise.resolve(Response.json(data,{status,headers:{"x-request-id":"qa"}}));});
 return {api,calls};
}
test("PAP-2288 search PII remains in POST body, cursor and abort preserved",async()=>{
 const {api,calls}=fixture({data:{items:[],hasMore:false,nextCursor:null}});
 const signal=new AbortController().signal;
 await api.search({q:"0900000000",limit:20,cursor:"opaque"},signal);
 assert.equal(calls[0]?.url,base+"/search");assert.equal(calls[0]?.init?.signal,signal);
 assert.equal(calls[0]?.init?.method,"POST");assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)),{q:"0900000000",limit:20,cursor:"opaque"});
 assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"),null);
 await api.history(id,{limit:5,cursor:"a+b"});
 assert.equal(calls[1]?.url,base+"/"+id+"/history?limit=5&cursor=a%2Bb");
});
test("PAP-2288 caller-owned retry key and CAS preserved, no implicit retry on conflict",async()=>{
 const {api,calls}=fixture({error:{code:"CONFLICT",message:"private"}},409);
 const contact={phone:"0900000000",contactDisplayName:"Synthetic"};
 await assert.rejects(api.contact(id,2,contact,key),(e:unknown)=>e instanceof LeadApiError&&e.status===409&&e.code==="CONFLICT"&&!e.message.includes("private"));
 assert.equal(calls.length,1);
 await assert.rejects(api.contact(id,2,contact,key),LeadApiError);
 assert.deepEqual(calls[1],calls[0]);
 assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"),key);
 assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)),{contact,expectedVersion:2});
});
test("PAP-2288 malformed responses and invalid identity/version/key fail closed",async()=>{
 const {api,calls}=fixture({data:{items:[],hasMore:true,nextCursor:null}});
 await assert.rejects(api.search(),(e:unknown)=>e instanceof LeadApiError&&e.status===502);
 assert.throws(()=>api.detail("LEAD-MOCK-001"),LeadApiError);
 assert.throws(()=>api.retireMember(id,id,0,key),LeadApiError);
 await assert.rejects(api.retireMember(id,id,1,"bad"),LeadApiError);
 assert.equal(calls.length,1);
});
test("PAP-2288 exact child path and version, no age observation supplied by client",async()=>{
 const {api,calls}=fixture({data:{leadId:id,version:3,memberId:id}});
 const member={displayName:"Synthetic",intendedRoles:["STUDENT" as const],gender:null,birthPrecision:"UNKNOWN" as const,birthYear:null,birthMonth:null,birthDay:null,reportedAge:8,interestKinds:["AFTERSCHOOL_ART" as const]};
 const result=await api.updateMember(id,id,2,member,key);
 assert.equal(result.version,3);
 assert.equal(calls[0]?.url,base+"/"+id+"/members/"+id+"/update");
 assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)),{member,expectedVersion:2});
});

test("PAP-2288 exact child receipt identity and nullable primary are enforced",async()=>{
 const other="01a03c6e-cc58-7d81-ac8e-123456789abd";
 await assert.rejects(fixture({data:{leadId:id,version:3,memberId:other}}).api.retireMember(id,id,2,key),LeadApiError);
 await assert.rejects(fixture({data:{leadId:id,version:3}}).api.primary(id,2,null,key),LeadApiError);
 assert.equal((await fixture({data:{leadId:id,version:3,memberId:null}}).api.primary(id,2,null,key)).memberId,null);
 await assert.rejects(fixture({data:{leadId:id,version:3,relationshipId:other}}).api.confirmRelation(id,id,2,key),LeadApiError);
 assert.equal((await fixture({data:{leadId:id,version:3,relationshipId:id}}).api.retireRelation(id,id,2,key)).relationshipId,id);
});
