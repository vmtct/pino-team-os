import {test} from "node:test";
import assert from "node:assert/strict";
import {createDraftController,DraftCommandPending,type DraftActorScope} from "../app/bo/piner-posts/draft-controller";
import {createSessionDraftJournal} from "../app/bo/piner-posts/draft-retry-journal";
const A="01900000-0000-7000-8000-000000000001",PERSON="01900000-0000-7000-8000-000000000005",POST="01900000-0000-7000-8000-000000000006";
const stamp="2026-11-18T00:00:00.000Z",sig=()=>new AbortController().signal;
const actor:DraftActorScope={actorId:"qa-actor-only",centerId:A,authorize:()=>true};
const row={id:POST,studentId:null,personId:PERSON,personName:"QA Person",studentName:null,programKey:"MYTIME" as const,centerId:A,centerName:"A",caption:"private example",status:"DRAFT",publisher:"MyTime by PINO",version:1,createdAt:stamp,updatedAt:stamp,createdBy:null,updatedBy:null,mediaCount:0};
const response=(data:unknown,status=200)=>Response.json({data},{status});
function setup(){const store=new Map<string,string>();const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}};return {store,storage};}
test("reload retries the same Person command without persisting private content",async()=>{
 const x=setup();let attempts=0,keys=0;const sent:string[]=[];
 const make=()=>createDraftController(actor,()=>actor,async(_p,init)=>{if(init?.method==="POST"){sent.push(new Headers(init.headers).get("idempotency-key")!);if(++attempts===1)throw Error("lost reply");return response({post:row,committedVersion:1,replayed:true});}return response(row);},()=>"opaque-command-000"+(++keys),createSessionDraftJournal(x.storage));
 const first=make();await assert.rejects(first.createDraft(PERSON,"MYTIME",row.caption,sig()));first.dispose();
 const contents=JSON.stringify([...x.store]);for(const raw of [row.caption,actor.actorId,A,PERSON,POST])assert(!contents.includes(raw));assert.equal(x.store.size,1);
 const second=make();assert(await second.hasRetainedCommand(sig()));await assert.rejects(second.createDraft(PERSON,"MYTIME","wrong",sig()),DraftCommandPending);
 assert.equal((await second.createDraft(PERSON,"MYTIME",row.caption,sig())).personId,PERSON);assert.equal(sent[0],sent[1]);assert.equal(keys,1);assert.equal(x.store.size,0);
});
test("retry storage failure blocks Person mutation before Core call",async()=>{
 const x=setup();let calls=0;const journal=createSessionDraftJournal({...x.storage,setItem(){throw Error("storage unavailable");}});
 const controller=createDraftController(actor,()=>actor,async()=>{calls++;throw Error("must not call");},()=>"opaque-command-0001",journal);
 await assert.rejects(controller.createDraft(PERSON,"MYTIME","",sig()));assert.equal(calls,0);
});