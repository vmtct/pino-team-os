import {test} from "node:test";
import assert from "node:assert/strict";
import {createLeadRecoveryApi,parseLeadRecoveryInput,parseLeadRecoveryReceipt,type LeadRecoveryInput} from "./bo-lead-recovery-api";
import {LeadApiError} from "./bo-lead-household-client";
import {openNativeLeadAdapter} from "../app/bo/sales/leads/native-lead-adapter";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc",other="01a03c6e-cc58-7d81-ac8e-123456789abd",key="synthetic-recovery-key-123";
const input:LeadRecoveryInput={kind:"contact",key,target:id,expectedVersion:1};
test("PAP-2288 recovery input and receipt are exact and bound to original target/CAS",()=>{
 assert.deepEqual(parseLeadRecoveryInput(input),input);
 for(const bad of [{...input,kind:"constructor"},{...input,key:"short"},{...input,target:"LEAD-MOCK-001"},{...input,expectedVersion:0},{...input,phone:"synthetic"},{...input,centerId:id},{...input,kind:"create"}])assert.equal(parseLeadRecoveryInput(bad),null);
 for(const bad of [{leadId:other,version:2},{leadId:id,version:3},{leadId:id,version:2,phone:"synthetic"},{leadId:id,version:2,created:true}])assert.equal(parseLeadRecoveryReceipt(bad,input),null);
 assert.deepEqual(parseLeadRecoveryReceipt({leadId:id,version:2},input),{leadId:id,version:2});
 const create={kind:"create",key,target:null,expectedVersion:null} as const;
 assert.equal(parseLeadRecoveryReceipt({leadId:id,version:1},create),null);
 assert.deepEqual(parseLeadRecoveryReceipt({leadId:id,version:1,created:false},create),{leadId:id,version:1,created:false});
});
test("PAP-2288 recovery transport never retries or sends write idempotency header",async()=>{
 const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const api=createLeadRecoveryApi(async(url,init)=>{calls.push({url:String(url),init});return Response.json({data:{leadId:id,version:2}});});
 assert.deepEqual(await api(input),{leadId:id,version:2});
 assert.equal(calls[0]?.url,"/api/bo/acquisition/households/recovery");
 assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)),input);
 assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"),null);
 assert.equal(calls.length,1);
 const denied=createLeadRecoveryApi(async()=>Response.json({error:{message:"private"}},{status:404}));
 await assert.rejects(denied(input),(e:unknown)=>e instanceof LeadApiError&&e.status===404&&!e.message.includes("private"));
 const malformed=createLeadRecoveryApi(async()=>Response.json({data:{leadId:other,version:2}}));
 await assert.rejects(malformed(input),(e:unknown)=>e instanceof LeadApiError&&e.status===502);
});
test("PAP-2288 native recovery uses same actor lifetime and disposal",async()=>{
 const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const adapter=openNativeLeadAdapter(id,"https://bo.staging.pinohouse.art",{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},async(url,init)=>{calls.push({url:String(url),init});return Response.json({data:{leadId:id,version:2}});});
 assert.deepEqual(await adapter.recover(input),{leadId:id,version:2});
 assert.equal(new Headers(calls[0]?.init?.headers).get("x-pino-expected-actor"),id);
 assert.equal(calls[0]?.url,"https://bo.staging.pinohouse.art/api/bo/acquisition/households/recovery");
 adapter.dispose();await assert.rejects(adapter.recover(input));assert.equal(calls.length,1);
});
