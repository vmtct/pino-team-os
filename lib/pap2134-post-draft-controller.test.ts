import {test} from "node:test";
import assert from "node:assert/strict";
import {createDraftController,DraftCommandPending,type DraftActorScope} from "../app/bo/piner-posts/draft-controller";
const A="01900000-0000-7000-8000-000000000001",B="01900000-0000-7000-8000-000000000002",PERSON="01900000-0000-7000-8000-000000000005",POST="01900000-0000-7000-8000-000000000006";
const stamp="2026-11-18T00:00:00.000Z",sig=()=>new AbortController().signal;
const raw=(extra:Record<string,unknown>={})=>({id:POST,studentId:null,personId:PERSON,personName:"QA Person",studentName:null,programKey:"MYTIME",centerId:A,centerName:"A",caption:"",status:"DRAFT",publisher:"MyTime by PINO",version:1,createdAt:stamp,updatedAt:stamp,createdBy:null,updatedBy:null,mediaCount:0,...extra});
const response=(data:unknown,status=200)=>Response.json({data},{status});
const scope=():DraftActorScope=>({actorId:"qa-actor",centerId:A,authorize:()=>true});
test("uncertain Person create retains key and reads back the committed draft",async()=>{
 let writes=0,keys=0;const sent:string[]=[];const actor=scope();
 const controller=createDraftController(actor,()=>actor,async(_path,init)=>{if(init?.method==="POST"){sent.push(new Headers(init.headers).get("idempotency-key")!);if(++writes===1)throw Error("lost response");return response({post:raw(),committedVersion:1,replayed:true});}return response(raw());},()=>"draft-command-0000"+(++keys));
 await assert.rejects(controller.createDraft(PERSON,"MYTIME","",sig()));assert(controller.hasUnresolvedCommand());
 await assert.rejects(controller.createDraft(PERSON,"MYTIME","changed",sig()),DraftCommandPending);assert.equal(keys,1);
 assert.equal((await controller.createDraft(PERSON,"MYTIME","",sig())).personId,PERSON);assert.equal(controller.hasUnresolvedCommand(),false);assert.deepEqual(sent,["draft-command-00001","draft-command-00001"]);
});
test("Person picker is scoped to selected Center and program and labels actor",async()=>{
 const actor=scope();let current:DraftActorScope|null=actor,calls=0;
 const controller=createDraftController(actor,()=>current,async(path)=>{calls++;const url=new URL(String(path),"https://bo.invalid");assert.equal(url.pathname,"/api/bo/learning/piner-posts/people");assert.equal(url.searchParams.get("centerId"),A);assert.equal(url.searchParams.get("programKey"),"MYTIME");return response({people:[{personId:PERSON,displayName:"QA Person",ageYears:30,phoneLast4:"1234",actorLabels:["GUEST"]}],nextAfter:null});});
 assert.deepEqual(await controller.personChoices("MYTIME",sig()),[{id:PERSON,label:"QA Person · Khách MyTime · 30 tuổi · •••• 1234"}]);assert.equal(calls,1);
 current={...actor,authorize:p=>p==="piner.post.view"};await assert.rejects(controller.personChoices("MYTIME",sig()));assert.equal(calls,1);
});
test("scope swap after write discards result and prevents further calls",async()=>{
 const actor=scope();let current:DraftActorScope|null=actor,calls=0;
 const controller=createDraftController(actor,()=>current,async(_p,init)=>{calls++;if(init?.method==="POST"){current={...actor,centerId:B};return response({post:raw(),committedVersion:1,replayed:false});}return response(raw());},()=>"draft-command-00001");
 await assert.rejects(controller.createDraft(PERSON,"MYTIME","",sig()));await assert.rejects(controller.list(sig()));assert.equal(calls,1);
});
test("caption edit uses CAS, stable retry key and authoritative readback",async()=>{
 const actor=scope();let reads=0;const keys:string[]=[];
 const controller=createDraftController(actor,()=>actor,async(_p,init)=>{if(init?.method==="PATCH"){keys.push(new Headers(init.headers).get("idempotency-key")!);assert.deepEqual(JSON.parse(String(init.body)),{caption:"x",expectedVersion:1});return response({post:raw({caption:"x",version:2}),committedVersion:2,replayed:false});}reads++;if(reads===1)return response({},503);return response(raw({caption:"x",version:2}));},()=>"edit-command-000001");
 await assert.rejects(controller.editCaption(POST,1,"x",sig()));assert.equal((await controller.editCaption(POST,1,"x",sig())).version,2);assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
});
test("concurrent commands cannot issue duplicate writes",async()=>{
 const actor=scope();let resolve:(r:Response)=>void=()=>{},calls=0;
 const controller=createDraftController(actor,()=>actor,async(_p,init)=>{if(init?.method==="POST"){calls++;return new Promise<Response>(r=>{resolve=r;});}return response(raw());},()=>"draft-command-00001");
 const first=controller.createDraft(PERSON,"MYTIME","",sig());await assert.rejects(controller.createDraft(PERSON,"MYTIME","",sig()),DraftCommandPending);assert.equal(calls,1);
 resolve(response({post:raw(),committedVersion:1,replayed:false}));await first;
});