import {test} from "node:test";
import assert from "node:assert/strict";
import {createLeadIntentApi,parseIntentCommand,parseIntentRecovery,parseIntentReceipt} from "./bo-lead-intent-api";
import {LeadApiError} from "./bo-lead-household-client";
import {openNativeLeadAdapter} from "../app/bo/sales/leads/native-lead-adapter";
const leadId="01a03c6e-cc58-7d81-ac8e-123456789abc",intentId="01a03c6e-cc58-7d81-ac8e-123456789abd",target={leadId,intentId},key="synthetic-intent-key-123";
const receipt={...target,status:"CONTACTED",version:2} as const;
const recovered={...receipt,currentStatus:"CONTACT_VERIFIED",currentVersion:3} as const;
test("PAP-2288 exact F1 child contract and minimal receipt",()=>{
 assert.deepEqual(parseIntentCommand({expectedVersion:1,reason:" x "},"close"),{expectedVersion:1,reason:"x"});
 for(const bad of [{expectedVersion:0},{expectedVersion:1,reason:""},{expectedVersion:1,reason:"x",centerId:leadId}])assert.equal(parseIntentCommand(bad,"close"),null);
 assert.equal(parseIntentCommand({expectedVersion:1,reason:"x"},"contacted"),null);
 assert.equal(parseIntentRecovery({action:"contacted",key:"short",expectedVersion:1}),null);
 assert.deepEqual(parseIntentReceipt(recovered,target,"contacted",1,true),recovered);
 for(const bad of [{...recovered,leadId:intentId},{...recovered,status:"CLOSED"},{...recovered,currentVersion:1},{...recovered,currentStatus:"SUBMITTED"},{...recovered,phone:"private"}])assert.equal(parseIntentReceipt(bad,target,"contacted",1,true),null);
});
test("PAP-2288 F1 child transition and recovery use exact actor lifetime, no retry or recovery write key",async()=>{
 const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const a=openNativeLeadAdapter(leadId,"https://bo.staging.pinohouse.art",{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},async(url,init)=>{calls.push({url:String(url),init});return Response.json({data:String(url).endsWith("/recovery")?recovered:receipt});});
 assert.deepEqual(await a.intent.transition(target,"contacted",{expectedVersion:1},key),receipt);
 assert.deepEqual(await a.intent.recover(target,{action:"contacted",key,expectedVersion:1}),recovered);
 assert.equal(calls[0]?.url,"https://bo.staging.pinohouse.art/api/bo/acquisition/households/"+leadId+"/intents/"+intentId+"/contacted");
 assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"),key);
 assert.equal(new Headers(calls[1]?.init?.headers).get("idempotency-key"),null);
 assert.equal(new Headers(calls[1]?.init?.headers).get("x-pino-expected-actor"),leadId);
 a.dispose();await assert.rejects(a.intent.recover(target,{action:"contacted",key,expectedVersion:1}));assert.equal(calls.length,2);
});
test("PAP-2288 child recovery absence and malformed receipt fail closed",async()=>{
 const missing=createLeadIntentApi(async()=>Response.json({error:{message:"private"}},{status:404}));
 await assert.rejects(missing.recover(target,{action:"contacted",key,expectedVersion:1}),(e:unknown)=>e instanceof LeadApiError&&e.status===404&&!e.message.includes("private"));
 const wrong=createLeadIntentApi(async()=>Response.json({data:{...receipt,intentId:leadId}}));
 await assert.rejects(wrong.transition(target,"contacted",{expectedVersion:1},key),LeadApiError);
});
test("PAP-2288 only exact child initial rejection proof is typed",async()=>{
 const {IntentDefinitiveRejection,intentRejectionProof}=await import("./bo-lead-intent-api");
 const proof=intentRejectionProof(target,"contacted",1,key);
 const api=createLeadIntentApi(async()=>Response.json({error:proof},{status:409}));
 await assert.rejects(api.transition(target,"contacted",{expectedVersion:1},key),IntentDefinitiveRejection);
 for(const body of [{error:{code:proof.code}},{error:{...proof,key:"different"}},{error:{...proof,phone:"private"}},{error:proof,extra:true}]){
  const bad=createLeadIntentApi(async()=>Response.json(body,{status:409}));
  await assert.rejects(bad.transition(target,"contacted",{expectedVersion:1},key),(e:unknown)=>e instanceof LeadApiError&&!(e instanceof IntentDefinitiveRejection));
 }
 await assert.rejects(api.recover(target,{action:"contacted",key,expectedVersion:1}),(e:unknown)=>e instanceof LeadApiError&&!(e instanceof IntentDefinitiveRejection));
});
