import test from "node:test";
import assert from "node:assert/strict";
import {openRunningClassProvider,parseRunningClassBootstrap} from "./running-class-provider";
import type {ClassCreate} from "./running-class-draft";
const id=(n:number)=>"01234567-89ab-7abc-8def-"+String(n).padStart(12,"0");
const center=id(1),other=id(9);
const command:ClassCreate={centerId:center,pathProgramId:id(2),learningSpaceId:id(3),operationalName:"Piano",weekdayIso:1,windowStartsLocal:"18:00",windowEndsLocal:"19:30",deliveryTopology:"FIXED_COHORT",optimalConcurrentCapacity:8,hardConcurrentCapacity:null,defaultParticipationMinutes:null,status:"INACTIVE"};
const row={...command,id:id(4),version:1};
const bootstrap=(rows:unknown[])=>({centers:[{id:center,status:"ACTIVE",displayName:"Center",timeZone:"Asia/Ho_Chi_Minh"}],paths:[{id:id(2),displayName:"Piano",status:"ACTIVE"}],learningSpaces:[{id:id(3),centerId:center,displayName:"Room",status:"ACTIVE"}],runningClasses:rows});
const response=(data:unknown,status=200)=>Response.json({data},{status});
async function setup(readOnly=false,expectedActorId=id(8)){
 const map=new Map<string,string>(),calls:{url:string;init?:RequestInit}[]=[],replies:(Response|Promise<Response>)[]=[];
 let selected=center,actor=id(8),allowed=true;
 const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(input),init});const r=replies.shift();if(!r)throw Error("unexpected fetch");return r;}) as typeof fetch;
 const provider=await openRunningClassProvider({centerId:center,expectedActorId,context:async()=>({userId:actor,surface:"BO",entitled:true,permissionKeys:allowed?[readOnly?"membership.subscription.view":"delivery.schedule.manage"]:[]}),selectedCenter:()=>selected,fetcher,storage,newKey:()=>"original-key"});
 return {provider,calls,replies,map,changeCenter:()=>{selected=other;},changeActor:()=>{actor=id(7);},revoke:()=>{allowed=false;}};
}
test("strict scoped bootstrap handles empty data and rejects duplicate, foreign or malformed rows",()=>{
 assert.equal(parseRunningClassBootstrap(bootstrap([]),center).records.length,0);
 for(const b of [bootstrap([row,row]),bootstrap([{...row,centerId:other}]),bootstrap([{...row,version:0}]),{...bootstrap([]),learningSpaces:[{id:id(3),centerId:other,status:"ACTIVE",displayName:"Room"}]},{...bootstrap([]),centers:[]}]){
  assert.throws(()=>parseRunningClassBootstrap(b,center));
 }
});
test("actual create and inline command adapter updates same canonical projected row only after scoped readback",async()=>{
 const m=await setup();m.replies.push(response(bootstrap([])));assert.deepEqual(await m.provider.load(),[]);
 m.replies.push(response(row,201),response(bootstrap([row])));
 const created=await m.provider.create(command);assert.equal(created.id,row.id);assert.equal(m.provider.find(row.id)?.version,1);assert.equal(created.createdAt,null);
 const next={...row,operationalName:"Art",version:2};
 m.replies.push(response(next),response(bootstrap([next])));
 await m.provider.edit({id:row.id,expectedVersion:1,changes:{operationalName:"Art"}});
 assert.equal(m.provider.find(row.id)?.version,2);assert.equal(m.provider.list().length,1);
 assert.equal(m.calls.filter(c=>c.init?.method==="POST").length,1);assert.equal(m.calls.filter(c=>c.init?.method==="PATCH").length,1);
 for(const call of m.calls){const write=call.init?.method==="POST"||call.init?.method==="PATCH";assert.equal(new Headers(call.init?.headers).get("x-pino-expected-principal"),write?id(8):null);}
});
test("actor, Center and permission changes deny mutations before transport and invalidate cache",async()=>{
 for(const change of ["changeCenter","changeActor","revoke"] as const){
  const m=await setup();m.replies.push(response(bootstrap([row])));await m.provider.load();m[change]();
  await assert.rejects(m.provider.create(command));assert.equal(m.calls.length,1);assert.equal(m.provider.state().loaded,false);
 }
});
test("stale edit cannot reach transport",async()=>{
 const m=await setup();m.replies.push(response(bootstrap([row])));await m.provider.load();
 await assert.rejects(m.provider.edit({id:row.id,expectedVersion:2,changes:{operationalName:"Art"}}),/Stale/);assert.equal(m.calls.length,1);
});

test("provider busy covers deferred reads, competing commands never reach transport",async()=>{
 const m=await setup();let release!:(r:Response)=>void;
 m.replies.push(new Promise<Response>(r=>{release=r;}));
 const loading=m.provider.load();assert.equal(m.provider.state().busy,true);
 await assert.rejects(m.provider.create(command),/busy/);
 release(response(bootstrap([row])));await loading;assert.equal(m.provider.state().busy,false);assert.equal(m.calls.length,1);
});
test("Center change during pending read discards result",async()=>{
 const m=await setup();let release!:(r:Response)=>void;let started!:()=>void;
 const entered=new Promise<void>(r=>{started=r;});
 m.replies.push({then(resolve:(r:Response)=>void){started();release=resolve;}} as Promise<Response>);
 const loading=m.provider.load();await entered;m.changeCenter();release(response(bootstrap([row])));
 await assert.rejects(loading,/scope/);assert.equal(m.provider.state().loaded,false);assert.throws(()=>m.provider.list());
});
test("unknown create and immutable edit fields fail before write",async()=>{
 const m=await setup();m.replies.push(response(bootstrap([row])));await m.provider.load();
 await assert.rejects(m.provider.create({...command,version:9} as ClassCreate),/create fields/);
 m.replies.push(response(bootstrap([row])));await m.provider.load();
 await assert.rejects(m.provider.edit({id:row.id,expectedVersion:1,changes:{centerId:other} as never}),/edit fields/);
 assert.equal(m.calls.length,2);
});

test("existing read-only actor sees strict scoped rows and cannot send or recover mutations",async()=>{
 const m=await setup(true);m.replies.push(response(bootstrap([row])));assert.equal((await m.provider.load()).length,1);assert.equal(m.provider.writable,false);assert.equal(m.provider.find(row.id)?.version,1);
 await assert.rejects(m.provider.create(command),/read-only/);await assert.rejects(m.provider.edit({id:row.id,expectedVersion:1,changes:{status:"ACTIVE"}}),/read-only/);await assert.rejects(m.provider.retry(),/read-only/);
 assert.equal(m.calls.length,1);assert.equal(m.map.size,0);assert.equal(m.provider.state().pending,false);assert.equal(m.provider.state().loaded,true);
 m.revoke();await assert.rejects(m.provider.load(),/scope denied/);assert.equal(m.provider.state().loaded,false);
});
test("server-bound expected actor rejects a different scoped principal before data transport",async()=>{await assert.rejects(setup(false,id(7)),/actor changed/);});


test("PAP-2397 maps canonical scoped audit metadata on load and command readback without sending audit fields",async()=>{
 const m=await setup(),createdAt="2026-11-26T01:02:03.456Z",updatedAt="2026-11-26T02:03:04.567Z";
 const first={...row,createdAt,updatedAt:createdAt,createdByName:"Synthetic Creator",updatedByName:"Synthetic Creator"};
 m.replies.push(response(bootstrap([first])));
 const initial=await m.provider.load();assert.equal(initial[0]?.createdAt,createdAt);assert.equal(initial[0]?.createdBy,"Synthetic Creator");
 assert.equal(m.provider.properties(row.id)?.updatedBy,"Synthetic Creator");
 const next={...row,operationalName:"Art",version:2};
 m.replies.push(response(next),response(bootstrap([{...next,createdAt,updatedAt,createdByName:"Synthetic Creator",updatedByName:"Synthetic Modifier"}])));
 const edited=await m.provider.edit({id:row.id,expectedVersion:1,changes:{operationalName:"Art"}});
 assert.equal(edited.updatedAt,updatedAt);assert.equal(edited.updatedBy,"Synthetic Modifier");assert.equal(m.provider.find(row.id)?.createdByName,"Synthetic Creator");
 const request=m.calls.find(c=>c.init?.method==="PATCH");assert.deepEqual(JSON.parse(String(request?.init?.body)),{expectedVersion:1,operationalName:"Art"});
});
test("PAP-2397 malformed or missing metadata stays unknown; never fabricate actor or time",()=>{
 const bad=parseRunningClassBootstrap(bootstrap([{...row,createdAt:"2026-02-31T01:00:00.000Z",updatedAt:"bad",createdByName:id(8),updatedByName:123}]),center).records[0];
 assert.equal(bad?.createdAt,null);assert.equal(bad?.updatedAt,null);assert.equal(bad?.createdByName,null);assert.equal(bad?.updatedByName,null);
 const old=parseRunningClassBootstrap(bootstrap([row]),center).records[0];assert.equal(old?.createdAt,null);assert.equal(old?.createdByName,null);
});
