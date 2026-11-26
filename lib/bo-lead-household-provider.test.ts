import {test} from "node:test";
import {LeadRecoveryJournal} from "../app/bo/sales/leads/lead-recovery-journal";
import assert from "node:assert/strict";
import {LeadApiError,createLeadHouseholdApi,type LeadDetail,type LeadMember,type LeadReceipt} from "./bo-lead-household-client";
import {LeadCommandFence,memberInput,presentLeadDetail,presentLeadRow,type LeadHouseholdApi,type LeadCommand} from "../app/bo/sales/leads/lead-household-provider";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc",child="01a03c6e-cc58-7d81-ac8e-123456789abd";
const member:LeadMember={id:child,status:"ACTIVE",version:1,displayName:"Synthetic",intendedRoles:["PARENT","GUEST"],gender:null,birthPrecision:"YEAR",birthYear:2018,birthMonth:null,birthDay:null,reportedAge:null,ageObservedAt:null,interestKinds:["MYTIME_PIANO"]};
function detail(version=2):LeadDetail{return {id,phone:"0900000000",contactDisplayName:null,status:"ACTIVE",primaryContactMemberId:null,version,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:01:00Z",createdBy:null,updatedBy:null,centerId:null,memberCount:1,intentCount:1,members:[member],relationships:[],intents:[{id:child,kind:"PROGRAM_INTEREST",sourceBrand:"PINO_HOUSE",sourceSurface:"PINO_HOUSE_WEB",status:"SUBMITTED",createdAt:"2026-11-25T00:00:00Z",version:1}],intentHistoryHasMore:false};}
function api(patch:Partial<LeadHouseholdApi>={}):LeadHouseholdApi{return {...createLeadHouseholdApi(()=>Promise.reject(new Error("unexpected request"))),detail:()=>Promise.resolve(detail()),...patch};}
function command():Extract<LeadCommand,{kind:"contact"}>{return {kind:"contact",leadId:id,expectedVersion:1,contact:{phone:"0900000000",contactDisplayName:"Original"}};}
test("PAP-2288 canonical DTO preserves declarations, partial DOB and separate history",()=>{
 const d=detail(),p=presentLeadDetail(d);
 assert.equal(p.contactName,null);assert.equal(p.memberCount,1);assert.deepEqual(p.interestKinds,["MYTIME_PIANO"]);assert.equal(p.intents.length,1);assert.equal(p.intents[0]?.kind,"PROGRAM_INTEREST");assert.equal(p.members[0]?.primaryContact,false);assert.deepEqual(p.members[0]?.intendedRoles,["PARENT","GUEST"]);assert.equal(p.members[0]?.birthPrecision,"YEAR");assert.equal(p.members[0]?.birthDay,null);
 assert.equal(presentLeadRow(d).intentCount,1);
 const input=memberInput(member,{displayName:"Changed"});assert.equal(input.birthYear,2018);assert.equal(input.birthDay,null);assert.equal("ageObservedAt" in input,false);
});
test("PAP-2288 uncertainty retains immutable exact payload and key through explicit retries",async()=>{
 const calls:Array<{key:string;name:string|null}>=[];const fence=new LeadCommandFence(api({contact:(_id,_v,c,k)=>{calls.push({key:k,name:c.contactDisplayName});return calls.length===1?Promise.reject(new TypeError("network")):calls.length===2?Promise.reject(new LeadApiError(409,"CONFLICT",null)):Promise.resolve({leadId:id,version:2});}}),()=>"key");
 const c=command();await assert.rejects(fence.submit(c));c.contact.contactDisplayName="Changed";assert.equal(fence.state,"uncertain");
 await assert.rejects(fence.submit(c),LeadApiError);assert.equal(calls.length,1);
 await assert.rejects(fence.retry(),LeadApiError);assert.equal(fence.state,"uncertain");assert.equal((await fence.retry()).version,2);assert.deepEqual(calls,Array(3).fill({key:"key",name:"Original"}));assert.equal(fence.state,"idle");
});
test("PAP-2288 receipt readback failure cannot resubmit; reload verifies target and version",async()=>{
 let reads=0,writes=0;const fence=new LeadCommandFence(api({detail:()=>{reads++;return Promise.resolve(detail(reads===1?1:2));},contact:()=>{writes++;return Promise.resolve({leadId:id,version:2});}}),()=>"key");
 await assert.rejects(fence.submit(command()),LeadApiError);assert.equal(fence.state,"reload_required");assert.equal(fence.reloadTarget,id);
 await assert.rejects(fence.reload(child),LeadApiError);await assert.rejects(fence.retry(),LeadApiError);await assert.rejects(fence.submit(command()),LeadApiError);
 assert.equal((await fence.reload(id)).version,2);assert.equal(writes,1);assert.equal(fence.state,"idle");
});
test("PAP-2288 exact conflict target, concurrent fence and explicit reload",async()=>{
 let finish:(value:LeadReceipt)=>void=()=>{};let calls=0;
 const fence=new LeadCommandFence(api({contact:()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.reject(new LeadApiError(409,"CONFLICT",null))}),()=>"key");
 const first=fence.submit(command());await assert.rejects(fence.submit(command()),LeadApiError);finish({leadId:id,version:2});await first;
 await assert.rejects(fence.submit(command()),LeadApiError);assert.equal(fence.state,"conflict");await assert.rejects(fence.reload(child),LeadApiError);await assert.rejects(fence.retry(),LeadApiError);await fence.reload(id);assert.equal(fence.state,"idle");
});
test("PAP-2288 create conflict reconciles original normalized phone and visible scope only",async()=>{
 const d=detail();const q:string[]=[];let calls=0;
 const fence=new LeadCommandFence(api({create:()=>Promise.reject(new LeadApiError(409,"CONFLICT",null)),search:(input)=>{q.push(input?.q??"");calls++;return Promise.resolve({items:calls===1?[]:[d],hasMore:calls===1,nextCursor:calls===1?"page2":null});}}),()=>"key");
 const c:Extract<LeadCommand,{kind:"create"}>={kind:"create",input:{contact:{phone:"+84 900 000 000",contactDisplayName:"Synthetic"}}};
 await assert.rejects(fence.submit(c),LeadApiError);c.input.contact.phone="0911111111";assert.equal(fence.isCreateConflict,true);
 await assert.rejects(fence.reload(child),LeadApiError);assert.equal((await fence.reloadCreateConflict())?.id,id);assert.deepEqual(q,["0900000000","0900000000"]);assert.equal(fence.state,"idle");
});
test("PAP-2288 inconsistent receipt version retains uncertainty",async()=>{
 const fence=new LeadCommandFence(api({contact:()=>Promise.resolve({leadId:id,version:3})}),()=>"key");
 await assert.rejects(fence.submit(command()),LeadApiError);assert.equal(fence.state,"uncertain");
});

test("PAP-2288 durable command fence restores known receipt without replay",async()=>{
 const s=memoryStorage();const scope=id,key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee";let writes=0,reads=0;
 const a=api({contact:()=>{writes++;return Promise.resolve({leadId:id,version:2});},detail:()=>{reads++;return Promise.resolve(detail(reads===1?1:2));}});
 const first=new LeadCommandFence(a,()=>key,new LeadRecoveryJournal(s,scope));await assert.rejects(first.submit(command()));assert.equal(first.state,"reload_required");
 const next=new LeadCommandFence(a,()=>key,new LeadRecoveryJournal(s,scope));assert.equal(next.state,"reload_required");await assert.rejects(next.submit(command()));await assert.rejects(next.retry());await next.reload(id);assert.equal(writes,1);assert.equal(next.state,"idle");assert.equal(new LeadRecoveryJournal(s,scope).inspect().state,"empty");
});
test("PAP-2288 durable fence denies unknown reload and preserves in-memory exact retry",async()=>{
 const s=memoryStorage();const key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee";let writes=0;
 const a=api({contact:()=>++writes===1?Promise.reject(new TypeError("lost ACK")):Promise.resolve({leadId:id,version:2})});
 const first=new LeadCommandFence(a,()=>key,new LeadRecoveryJournal(s,id));await assert.rejects(first.submit(command()));
 const next=new LeadCommandFence(a,()=>key,new LeadRecoveryJournal(s,id));assert.equal(next.state,"recovery_blocked");await assert.rejects(next.submit(command()));await assert.rejects(next.retry());await assert.rejects(next.reload(id));assert.equal(writes,1);
 await first.retry();assert.equal(writes,2);assert.equal(new LeadRecoveryJournal(s,id).inspect().state,"empty");
});
test("PAP-2288 durable journal unavailable blocks command before dispatch",async()=>{
 let writes=0;const a=api({contact:()=>{writes++;return Promise.resolve({leadId:id,version:2});}});
 const f=new LeadCommandFence(a,()=>"8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",new LeadRecoveryJournal({...memoryStorage(),setItem:()=>{throw Error("storage");}},id));await assert.rejects(f.submit(command()));assert.equal(f.state,"recovery_blocked");assert.equal(writes,0);
});
function memoryStorage(){let raw:string|null=null;return {getItem:()=>raw,setItem:(_slot:string,value:string)=>{raw=value;},removeItem:()=>{raw=null;}};}

test("PAP-2288 Create contact-only reuse and wrong-phone readback",async()=>{
 const create:LeadCommand={kind:"create",input:{contact:{phone:"0900000000",contactDisplayName:null}}};
 let reads=0,writes=0;
 const f=new LeadCommandFence(api({create:()=>{writes++;return Promise.resolve({leadId:id,version:2,created:false});},detail:()=>Promise.resolve({...detail(),phone:++reads===1?"0900000001":"0900000000"})}),()=>"key");
 await assert.rejects(f.submit(create));assert.equal(f.state,"reload_required");assert.equal(f.createOutcome,"reused");await f.reload(id);assert.equal(f.state,"idle");assert.equal(writes,1);assert.equal(f.createOutcome,"reused");
});
test("PAP-2288 duplicate receipt cannot imply member creation",async()=>{
 const f=new LeadCommandFence(api({create:()=>Promise.resolve({leadId:id,version:2,created:false})}),()=>"key");
 await assert.rejects(f.submit({kind:"create",input:{contact:{phone:"0900000000",contactDisplayName:null},members:[memberInput(member)]}}));assert.equal(f.state,"uncertain");assert.equal(f.createOutcome,null);
});

test("PAP-2288 Create wrong-phone receipt cannot become valid after reload",async()=>{
 const s=memoryStorage(),key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee";let writes=0,reads=0;
 const a=api({create:()=>{writes++;return Promise.resolve({leadId:id,version:2,created:false});},detail:()=>Promise.resolve({...detail(),phone:++reads===1?"0900000001":"0900000000"})});
 const journal=new LeadRecoveryJournal(s,id),f=new LeadCommandFence(a,()=>key,journal);
 await assert.rejects(f.submit({kind:"create",input:{contact:{phone:"0900000000",contactDisplayName:null}}}));assert.equal(f.state,"reload_required");assert.equal(journal.inspect().state,"unknown");assert.ok(!s.getItem()?.includes("0900000000"));
 const restored=new LeadCommandFence(a,()=>key,new LeadRecoveryJournal(s,id));assert.equal(restored.state,"recovery_blocked");await assert.rejects(restored.reload(id));await assert.rejects(restored.retry());assert.equal(writes,1);assert.equal(reads,1);
 await f.reload(id);assert.equal(journal.inspect().state,"empty");assert.equal(writes,1);
});
test("PAP-2288 explicit committed recovery verifies opaque tuple and readback without command resend",async()=>{
 const s=memoryStorage(),key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",j=new LeadRecoveryJournal(s,id);
 j.begin(command(),key);
 let writes=0,reads=0,lookups=0;
 const a=api({contact:()=>{writes++;return Promise.resolve({leadId:id,version:2});},detail:()=>Promise.resolve(detail(++reads===1?1:3))});
 const f=new LeadCommandFence(a,undefined,j,async input=>{lookups++;assert.deepEqual(input,{kind:"contact",key,target:id,expectedVersion:1});return {leadId:id,version:2};});
 assert.equal(f.canRecover,true);
 await assert.rejects(f.recoverCommitted());assert.equal(f.state,"recovery_blocked");assert.equal(j.inspect().state,"unknown");
 assert.equal((await f.recoverCommitted()).version,3);assert.equal(j.inspect().state,"empty");assert.equal(f.state,"idle");assert.equal(writes,0);assert.equal(lookups,2);
});
test("PAP-2288 recovery absence, wrong receipt and replaced journal remain blocked",async()=>{
 const key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee";
 for(const mode of ["missing","wrong","changed"]){
  const s=memoryStorage(),j=new LeadRecoveryJournal(s,id);j.begin(command(),key);
  const f=new LeadCommandFence(api(),undefined,j,async()=>{
   if(mode==="missing")throw new LeadApiError(404,"LEAD_RECOVERY_UNAVAILABLE",null);
   if(mode==="wrong")return {leadId:child,version:2};
   j.rejectInitial(key);j.begin({...command(),expectedVersion:2},key);return {leadId:id,version:2};
  });
  await assert.rejects(f.recoverCommitted());assert.equal(f.state,"recovery_blocked");assert.equal(j.inspect().state,"unknown");
 }
});
test("PAP-2288 create after reload uses server committed proof, not original phone or a new write",async()=>{
 const key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",s=memoryStorage(),j=new LeadRecoveryJournal(s,id);
 j.begin({kind:"create",input:{contact:{phone:"0900000001",contactDisplayName:"Private"}}},key);
 const f=new LeadCommandFence(api({create:()=>{throw Error("unexpected write");}}),undefined,j,async input=>{assert.deepEqual(input,{kind:"create",key,target:null,expectedVersion:null});return {leadId:id,version:1,created:false};});
 assert.equal((await f.recoverCommitted()).id,id);assert.equal(f.createOutcome,"reused");assert.equal(j.inspect().state,"empty");
});
test("PAP-2288 child and household share the same journal, recovery never resends close reason",async()=>{
 const s=memoryStorage(),key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",j=new LeadRecoveryJournal(s,id);
 const target={leadId:id,intentId:child};let writes=0,lookups=0;
 const intentApi={transition:async()=>{writes++;throw new TypeError("lost ACK");},recover:async()=>{lookups++;return {...target,status:"CLOSED" as const,version:2,currentStatus:"CLOSED" as const,currentVersion:2};}};
 const f=new LeadCommandFence(api(),()=>key,j,undefined,intentApi);
 await assert.rejects(f.submitIntent(target,"close",{expectedVersion:1,reason:"Private close reason"}));
 assert.equal(j.inspect().state,"intent_unknown");assert.ok(!s.getItem()?.includes("Private close reason"));
 await assert.rejects(f.submit(command()));assert.throws(()=>j.begin(command(),key));
 const reloaded=new LeadCommandFence(api(),()=>key,new LeadRecoveryJournal(s,id),undefined,intentApi);
 assert.equal(reloaded.canRecover,true);await assert.rejects(reloaded.submit(command()));await reloaded.recoverCommitted();
 assert.equal(j.inspect().state,"empty");assert.equal(reloaded.state,"idle");assert.equal(writes,1);assert.equal(lookups,1);
});
test("PAP-2288 child committed receipt and readback required; missing stays locked",async()=>{
 const s=memoryStorage(),key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",j=new LeadRecoveryJournal(s,id),target={leadId:id,intentId:child};
 let writes=0,lookups=0;
 const intentApi={transition:async()=>{writes++;return {...target,status:"CONTACTED" as const,version:2};},recover:async()=>{lookups++;if(lookups===1)throw new LeadApiError(404,"LEAD_INTENT_REQUEST_FAILED",null);return {...target,status:"CONTACTED" as const,version:2,currentStatus:"CONTACT_VERIFIED" as const,currentVersion:3};}};
 const f=new LeadCommandFence(api(),()=>key,j,undefined,intentApi);
 await assert.rejects(f.submitIntent(target,"contacted",{expectedVersion:1}));assert.equal(j.inspect().state,"intent_unknown");
 await f.recoverCommitted();assert.equal(writes,1);assert.equal(lookups,2);assert.equal(j.inspect().state,"empty");
 j.begin(command(),key);assert.throws(()=>j.beginIntent(target,"contacted",1,key));
});
test("PAP-2288 definitive child rejection survives reload and clears only after authorized readback",async()=>{
 const {IntentDefinitiveRejection}=await import("./bo-lead-intent-api");
 const s=memoryStorage(),key="8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee",j=new LeadRecoveryJournal(s,id),target={leadId:id,intentId:child};
 let writes=0,reads=0;
 const intentApi={transition:async()=>{writes++;throw new IntentDefinitiveRejection(null);},recover:async()=>{throw Error("unexpected lookup");}};
 const a=api({detail:()=>{reads++;return reads===1?Promise.reject(new LeadApiError(403,"DENIED",null)):Promise.resolve(detail());}});
 const f=new LeadCommandFence(a,()=>key,j,undefined,intentApi);
 await assert.rejects(f.submitIntent(target,"contacted",{expectedVersion:1}),IntentDefinitiveRejection);
 assert.equal(j.inspect().state,"intent_rejected");
 const r=new LeadCommandFence(a,()=>key,new LeadRecoveryJournal(s,id),undefined,intentApi);
 await assert.rejects(r.recoverCommitted());assert.equal(j.inspect().state,"intent_rejected");
 await r.recoverCommitted();assert.equal(j.inspect().state,"empty");assert.equal(r.state,"idle");assert.equal(writes,1);
});
