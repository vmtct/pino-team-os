import test from "node:test";
import assert from "node:assert/strict";
import { BoPublicViewCoreClient, BoPublicViewHttpError } from "./bo-public-view-core-client";
import { defaultBoViewConfig, type BoViewWrite } from "./bo-public-view-state";

const fields=["name","id","status","student","amount"];
const id1="0199dc10-0000-7000-8000-000000000111";
const id2="0199dc10-0000-7000-8000-000000000222";
const config=defaultBoViewConfig(fields);
const row=(id=id1,version=1,name="Test",position=0)=>({
  id,moduleKey:"staff",version,name,position,isDefault:false,config,updatedAt:"2026-10-22T00:00:00.000Z",
});
type Seen={url:string; method:string; auth:string|null; body:unknown};
const setup=(response:(request:Seen)=>Response,role:"manager"|"staff"="manager")=>{
  const seen:Seen[]=[];
  let issued=0;
  const mock=async (input:RequestInfo|URL,init?:RequestInit)=>{
    const item={url:String(input),method:init?.method??"GET",auth:new Headers(init?.headers).get("authorization"),
      body:init?.body ? JSON.parse(String(init.body)) as unknown : undefined};
    seen.push(item);
    return response(item);
  };
  const client=new BoPublicViewCoreClient({
    baseUrl:"https://bo.pinohouse.art",moduleKey:"staff",allowedFields:fields,role,
    bearer:()=>{issued++;return "safe-test-token";},fetchImpl:mock as typeof fetch,
  });
  return {client,seen,get issued(){return issued;}};
};
const ok=(data:unknown)=>new Response(JSON.stringify({data}),{
  status:200,headers:{"content-type":"application/json"},
});

test("read shared views with bearer; parse and sort; no owner/private context",async()=>{
  const o=setup(()=>ok([row(id2,4,"Second",1),row(id1,2,"First",0)]),"staff");
  const views=await o.client.list();
  assert.deepEqual(views.map(x=>x.id),[id1,id2]);
  assert.equal(o.seen.length,1);
  assert.equal(o.seen[0].method,"GET");
  assert.equal(o.seen[0].auth,"Bearer safe-test-token");
  assert.equal(o.seen[0].url,"https://bo.pinohouse.art/v1/team/bo/views/staff");
  assert.equal(JSON.stringify(views).includes("owner"),false);
});

test("Staff cannot issue create/update/rename/delete/reorder (no fetch or bearer)",async()=>{
  const o=setup(()=>ok([]),"staff");
  const ops:BoViewWrite[]=[
    {kind:"create",moduleKey:"staff",id:"local",name:"New",position:0,config},
    {kind:"update",moduleKey:"staff",id:id1,expectedVersion:1,config},
    {kind:"rename",moduleKey:"staff",id:id1,expectedVersion:1,name:"New"},
    {kind:"delete",moduleKey:"staff",id:id1,expectedVersion:1},
    {kind:"reorder",moduleKey:"staff",positions:[{id:id1,expectedVersion:1,position:0}]},
  ];
  for (const x of ops) {
    await assert.rejects(()=>{
      switch(x.kind) {
        case "create":return o.client.create(x);
        case "update":return o.client.update(x);
        case "rename":return o.client.rename(x);
        case "delete":return o.client.remove(x);
        case "reorder":return o.client.reorder(x);
      }
    },/Staff can modify only/);
  }
  assert.equal(o.seen.length,0);
  assert.equal(o.issued,0);
});

test("create sends only metadata, not local temp id; Core chooses durable UUID",async()=>{
  const o=setup(()=>ok(row(id2,1,"New",1)));
  const created=await o.client.create({kind:"create",moduleKey:"staff",id:"local-temp-id",
    name:"New",position:29,config});
  assert.equal(created.id,id2);
  assert.deepEqual(o.seen[0].body,{name:"New",config});
  assert.equal(o.seen[0].method,"POST");
});

test("PATCH uses expectedVersion and response version check",async()=>{
  const o=setup(()=>ok(row(id1,5)));
  const result=await o.client.update({kind:"update",moduleKey:"staff",id:id1,expectedVersion:4,config});
  assert.equal(result.version,5);
  assert.equal(o.seen[0].method,"PATCH");
  assert.deepEqual(o.seen[0].body,{expectedVersion:4,config});
});
test("409 never retries and exposes error status for queue hold",async()=>{
  const o=setup(()=>new Response(JSON.stringify({error:{code:"PLATFORM_CONFLICT"}}),{status:409}));
  await assert.rejects(o.client.update({kind:"update",moduleKey:"staff",id:id1,expectedVersion:4,config}),
    (error:unknown)=>error instanceof BoPublicViewHttpError && error.status===409 && error.reason==="conflict");
  assert.equal(o.seen.length,1);
});
test("forbidden response blocks mutation and never echoes sensitive server body",async()=>{
  const o=setup(()=>new Response("SECRET INTERNAL ERROR",{status:403}));
  await assert.rejects(o.client.create({kind:"create",moduleKey:"staff",id:"new",name:"A",position:0,config}),
    (error:unknown)=>error instanceof BoPublicViewHttpError && error.reason==="forbidden" &&
      !error.message.includes("SECRET"));
});
test("rename and remove use versioned narrow command payloads",async()=>{
  const o=setup(req=>{
    if(req.method==="DELETE")return ok({id:id1,deleted:true});
    return ok(row(id1,3,"Renamed"));
  });
  const renamed=await o.client.rename({kind:"rename",moduleKey:"staff",id:id1,name:"Renamed",expectedVersion:2});
  assert.equal(renamed.name,"Renamed");
  await o.client.remove({kind:"delete",moduleKey:"staff",id:id1,expectedVersion:3});
  assert.equal(o.seen[0].url.endsWith("/"+id1+"/rename"),true);
  assert.deepEqual(o.seen[0].body,{expectedVersion:2,name:"Renamed"});
  assert.equal(o.seen[1].method,"DELETE");
  assert.deepEqual(o.seen[1].body,{expectedVersion:3});
});
test("reorder sends complete version vector and validates acknowledgements",async()=>{
  const o=setup(()=>ok([row(id2,2,"Second",0),row(id1,2,"First",1)]));
  const views=await o.client.reorder({kind:"reorder",moduleKey:"staff",
    positions:[{id:id2,position:0,expectedVersion:1},{id:id1,position:1,expectedVersion:1}]});
  assert.deepEqual(views.map(x=>x.id),[id2,id1]);
  assert.equal(o.seen[0].url.endsWith("/staff/reorder"),true);
  assert.deepEqual(o.seen[0].body,{positions:[
    {id:id2,position:0,expectedVersion:1},{id:id1,position:1,expectedVersion:1},
  ]});
});
test("rejects malformed server response, foreign module, stale version, and unsafe origins",async()=>{
  assert.throws(()=>new BoPublicViewCoreClient({
    baseUrl:"http://api.public.example",moduleKey:"staff",allowedFields:fields,
    role:"manager",bearer:()=>"secret",
  }),/HTTPS/);
  assert.throws(()=>new BoPublicViewCoreClient({
    baseUrl:"https://user:pass@bo.pinohouse.art",moduleKey:"staff",allowedFields:fields,
    role:"manager",bearer:()=>"secret",
  }),/canonical/);
  const o=setup(()=>ok([{...row(),moduleKey:"payroll"}]));
  await assert.rejects(o.client.list(),
    (e:unknown)=>e instanceof BoPublicViewHttpError && e.reason==="invalid_response");
  const x=setup(()=>ok(row(id1,2)));
  await assert.rejects(x.client.update({kind:"update",moduleKey:"payroll",id:id1,config,expectedVersion:1}),/module mismatch/i);
  await assert.rejects(x.client.update({kind:"update",moduleKey:"staff",id:id1,config,expectedVersion:0}),/Invalid version/);
  assert.equal(x.seen.length,0);
});
test("invalid JSON response is safe failure, not a retry",async()=>{
  const o=setup(()=>new Response("not json",{status:200}));
  await assert.rejects(o.client.list(),
    (e:unknown)=>e instanceof BoPublicViewHttpError && e.status===502);
  assert.equal(o.seen.length,1);
});

test("cookie BO transport uses same-origin BFF without bearer and holds 409",async()=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,"window");
  Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{href:"https://bo.pinohouse.art/bo"}}});
  try {
    const calls:Array<{url:string;init:RequestInit|undefined}>=[];
    const client=new BoPublicViewCoreClient({baseUrl:"https://bo.pinohouse.art",moduleKey:"staff",allowedFields:fields,role:"manager",authMode:"team_cookie",
      fetchImpl:async (input,init)=>{calls.push({url:String(input),init});return new Response(JSON.stringify({error:{code:"PLATFORM_CONFLICT"}}),{status:409});}});
    await assert.rejects(client.update({kind:"update",moduleKey:"staff",id:id1,expectedVersion:4,config}),
      (error:unknown)=>error instanceof BoPublicViewHttpError && error.status===409);
    assert.equal(calls.length,1);assert.equal(calls[0].url,`https://bo.pinohouse.art/api/bo/views/staff/${id1}`);
    assert.equal(calls[0].init?.credentials,"same-origin");
    assert.equal(new Headers(calls[0].init?.headers).has("authorization"),false);
  } finally {
    if(before)Object.defineProperty(globalThis,"window",before);else Reflect.deleteProperty(globalThis,"window");
  }
});
for (const frozenThrough of [undefined, null, "status"] as const) test(`PAP-1105 client: wire freeze ${String(frozenThrough)} roundtrips`, async () => {
  const value = { ...config, columns: { ...config.columns, ...(frozenThrough !== undefined ? { frozenThrough } : {}) } };
  const o = setup(() => ok({ ...row(id1, 2), config: value }));
  const result = await o.client.update({kind:"update",moduleKey:"staff",id:id1,expectedVersion:1,config:value});
  assert.deepEqual((o.seen[0].body as {config:unknown}).config, value);
  assert.deepEqual(result.config, value);
  assert.equal(Object.hasOwn(result.config.columns,"frozenThrough"),frozenThrough !== undefined);
});
