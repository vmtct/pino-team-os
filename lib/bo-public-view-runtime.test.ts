import test from "node:test";
import assert from "node:assert/strict";
import { BoPublicViewRuntime } from "./bo-public-view-runtime";
import { BoPublicViewCoreClient } from "./bo-public-view-core-client";
import { defaultBoViewConfig, type BoPublicView, type BoViewConfig } from "./bo-public-view-state";

const ids=[
  "0199dc10-0000-7000-8000-000000000111",
  "0199dc10-0000-7000-8000-000000000222",
  "0199dc10-0000-7000-8000-000000000333",
];
const moduleKey="staff";
const fields=["id","name","status","role"];
const blank=()=>defaultBoViewConfig(fields);
const edited=(search:string):BoViewConfig=>({...blank(),search,groupBy:"status",
  columns:{order:["id","name","role","status"],visible:["name","status"]}});
const record=(id:string,position:number,version=1,config=blank()):BoPublicView=>({
  id,moduleKey,name:"View "+position,position,version,config,
});
type MockCall={method:string;path:string;body:Record<string,unknown>|undefined};
function fakeServer(initial:BoPublicView[]=[record(ids[0],0)]){
  const rows=new Map(initial.map(v=>[v.id,structuredClone(v)]));
  const calls:MockCall[]=[];
  let seq=initial.length;
  let rejectNext=false;
  let onNextWrite: (()=>void)|null=null;
  const failNext=()=>{rejectNext=true;};
  const nextWrite=(fn:()=>void)=>{onNextWrite=fn;};
  const response=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
  const handler=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const method=init?.method??"GET";
    const url=new URL(String(input));
    const segments=url.pathname.split("/").filter(Boolean);
    const id=segments[5];
    const body=init?.body?JSON.parse(String(init.body)) as Record<string,unknown>:undefined;
    calls.push({method,path:url.pathname,body});
    if (method!=="GET" && onNextWrite) { const f=onNextWrite;onNextWrite=null;f(); }
    if (method!=="GET" && rejectNext){rejectNext=false;return response(null,409);}
    if(method==="GET")return response([...rows.values()].sort((a,b)=>a.position-b.position));
    if(method==="POST"){
      const idNext=ids[seq++];
      if(!idNext)throw new Error("Too many test creates");
      const created:BoPublicView={id:idNext,moduleKey,name:String(body?.name),position:rows.size,version:1,
        config:body?.config as BoViewConfig};
      rows.set(idNext,created);
      return response(created,201);
    }
    if(segments[5]==="reorder"&&method==="PUT"){
      const positions=body?.positions as {id:string;expectedVersion:number;position:number}[];
      if(positions.length!==rows.size || positions.some(x=>rows.get(x.id)?.version!==x.expectedVersion))return response(null,409);
      for(const x of positions){const old=rows.get(x.id)!;rows.set(x.id,{...old,position:x.position,version:old.version+1});}
      return response([...rows.values()].sort((a,b)=>a.position-b.position));
    }
    if(!id || !rows.has(id))return response(null,404);
    const old=rows.get(id)!;
    if(Number(body?.expectedVersion)!==old.version)return response(null,409);
    if(method==="PATCH"){
      const changed={...old,version:old.version+1,
        ...(segments[6]==="rename"?{name:String(body?.name)}:{config:body?.config as BoViewConfig})};
      rows.set(id,changed);
      return response(changed);
    }
    if(method==="DELETE"){rows.delete(id);return response({id,deleted:true});}
    return response(null,405);
  };
  const client=(role:"manager"|"staff")=>new BoPublicViewCoreClient({
    baseUrl:"https://bo.pinohouse.art",moduleKey,allowedFields:fields,role,bearer:()=>"fake-session",
    fetchImpl:handler as typeof fetch,
  });
  const runtime=(role:"manager"|"staff"="manager",debounceMs=500)=>new BoPublicViewRuntime({
    moduleKey,allowedFields:fields,role,client:client(role),debounceMs,
  });
  return {runtime,calls,rows,failNext,nextWrite};
}
test("loads module-scoped views with real Core client, selects tabs and protects snapshots",async()=>{
  const env=fakeServer([record(ids[0],0),record(ids[1],1)]);
  const rt=env.runtime();
  const notifications:string[]=[];
  const unsubscribe=rt.subscribe(s=>notifications.push(s.status));
  assert.equal(rt.getSnapshot().status,"unloaded");
  await rt.load();
  assert.equal(rt.getSnapshot().status,"ready");
  assert.equal(rt.getSnapshot().state?.views.length,2);
  rt.select(ids[1]);
  const snapshot=rt.getSnapshot();
  assert.equal(snapshot.state?.activeId,ids[1]);
  snapshot.state!.views[0].name="tampered";
  assert.equal(rt.getSnapshot().state?.views[0].name,"View 0");
  assert.ok(notifications.includes("loading"));
  unsubscribe();rt.dispose();
});

test("Manager config updates are versioned and acknowledged through the queue",async()=>{
  const env=fakeServer();
  const rt=env.runtime();
  await rt.load(ids[0]);
  rt.edit(edited("first"));
  rt.edit(edited("second"));
  await rt.flush();
  const writes=env.calls.filter(c=>c.method==="PATCH");
  assert.equal(writes.length,1);
  assert.equal(writes[0].body?.expectedVersion,1);
  assert.equal((writes[0].body?.config as BoViewConfig).search,"second");
  assert.equal(rt.getSnapshot().state?.views[0].version,2);
  assert.equal(rt.getSnapshot().state?.effective.search,"second");
  rt.edit(edited("third"));
  await rt.flush();
  assert.equal(env.calls.filter(c=>c.method==="PATCH")[1].body?.expectedVersion,2);
  assert.equal(rt.getSnapshot().state?.views[0].version,3);
  rt.dispose();
});

test("Staff changes transient effective state, never sends mutations or changes public definitions",async()=>{
  const env=fakeServer();
  const rt=env.runtime("staff");
  await rt.load(ids[0]);
  rt.edit(edited("temporary"));
  await rt.flush();
  assert.equal(rt.getSnapshot().state?.localDraft,true);
  assert.equal(rt.getSnapshot().state?.effective.search,"temporary");
  assert.equal(rt.getSnapshot().state?.views[0].config.search,"");
  assert.equal(env.calls.filter(c=>c.method!=="GET").length,0);
  await assert.rejects(rt.create("Not permitted"),/BO Manager/);
  await assert.rejects(rt.rename(ids[0],"New"),/BO Manager/);
  await assert.rejects(rt.remove(ids[0]),/BO Manager/);
  await assert.rejects(rt.reorder([ids[0]]),/BO Manager/);
  rt.dispose();
});

test("create snapshots current unsaved All config, reconciles Core UUID, no temporary ID persisted",async()=>{
  const env=fakeServer();
  const rt=env.runtime();
  await rt.load();
  rt.edit(edited("renew"));
  const created=await rt.create("Renewal");
  assert.equal(created.id,ids[1]);
  assert.equal(rt.getSnapshot().state?.activeId,ids[1]);
  assert.equal(rt.getSnapshot().state?.effective.search,"renew");
  const sent=env.calls.find(c=>c.method==="POST");
  assert.ok(sent);
  assert.deepEqual(Object.keys(sent.body!).sort(),["config","name"]);
  assert.equal(env.rows.get(ids[1])?.name,"Renewal");
  rt.dispose();
});

test("rename/delete/reorder include updated versions, Core UUIDs, preserve selection",async()=>{
  const env=fakeServer([record(ids[0],0),record(ids[1],1)]);
  const rt=env.runtime();
  await rt.load(ids[0]);
  await rt.rename(ids[0],"Fresh");
  assert.equal(env.rows.get(ids[0])?.version,2);
  assert.equal(rt.getSnapshot().state?.activeId,ids[0]);
  await rt.reorder([ids[1],ids[0]]);
  assert.deepEqual(rt.getSnapshot().state?.views.map(v=>v.id),[ids[1],ids[0]]);
  assert.equal(env.rows.get(ids[0])?.version,3);
  await rt.remove(ids[0]);
  assert.equal(rt.getSnapshot().state?.activeId,null);
  assert.equal(rt.getSnapshot().state?.views.length,1);
  assert.equal(env.rows.has(ids[0]),false);
  rt.dispose();
});

test("two independent managers share persisted config; old version is held on 409",async()=>{
  const env=fakeServer();
  const a=env.runtime(),b=env.runtime();
  await a.load(ids[0]);await b.load(ids[0]);
  a.edit(edited("saved by a"));await a.flush();
  b.edit(edited("stale from b"));await b.flush();
  // Queue's async issue callback must fetch server version before presenting conflict.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(b.getSnapshot().error?.kind,"version_conflict");
  assert.equal(b.getSnapshot().state?.conflict?.server.version,2);
  assert.equal(env.rows.get(ids[0])?.config.search,"saved by a");
  await b.resolveUpdateConflict("discard");
  assert.equal(b.getSnapshot().state?.conflict,null);
  assert.equal(b.getSnapshot().state?.effective.search,"saved by a");
  b.edit(edited("fresh b"));await b.flush();
  assert.equal(env.rows.get(ids[0])?.config.search,"fresh b");
  a.dispose();b.dispose();
});

test("explicit reapply after conflict uses fetched server version, not stale local version",async()=>{
  const env=fakeServer();
  const a=env.runtime(),b=env.runtime();
  await a.load(ids[0]);await b.load(ids[0]);
  a.edit(edited("a"));await a.flush();
  b.edit(edited("b"));await b.flush();
  await new Promise(resolve=>setImmediate(resolve));
  await b.resolveUpdateConflict("reapply");
  await b.flush();
  assert.equal(env.rows.get(ids[0])?.config.search,"b");
  assert.equal(b.getSnapshot().state?.views[0].version,3);
  a.dispose();b.dispose();
});

test("ambiguous failed create does not blindly retry or leave temporary row",async()=>{
  const env=fakeServer();
  const rt=env.runtime();
  await rt.load();
  env.failNext();
  await assert.rejects(rt.create("Failed"),/conflict/i);
  assert.equal(rt.getSnapshot().state?.views.length,1);
  assert.equal(env.calls.filter(c=>c.method==="POST").length,1);
  assert.equal(rt.getSnapshot().error?.kind,"version_conflict");
  rt.dispose();
});

test("disposing prevents callbacks, clears queue and stops further commands",async()=>{
  const env=fakeServer();
  const rt=env.runtime();
  await rt.load(ids[0]);
  rt.edit(edited("pending"));
  rt.dispose();
  await assert.rejects(rt.flush(),/disposed/);
  assert.throws(()=>rt.select(null),/disposed/);
  assert.equal(env.calls.filter(c=>c.method!=="GET").length,0);
});

test("failed queued update blocks structural writes and blind reload until resolved",async()=>{
  const env=fakeServer([record(ids[0],0),record(ids[1],1)]);
  const rt=env.runtime();
  await rt.load(ids[0]);
  env.failNext();
  rt.edit(edited("conflicted write"));
  await rt.flush();
  await assert.rejects(rt.rename(ids[1],"Unsafe"),/Resolve failed or conflicted/);
  await assert.rejects(rt.reorder([ids[1],ids[0]]),/Resolve failed or conflicted/);
  await assert.rejects(rt.load(ids[0]),/Resolve or flush pending/);
  assert.equal(env.calls.filter(c=>c.method==="PATCH").length,1);
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(rt.getSnapshot().state?.conflict);
  await rt.resolveUpdateConflict("discard");
  await rt.rename(ids[1],"Safe");
  assert.equal(env.rows.get(ids[1])?.name,"Safe");
  rt.dispose();
});
