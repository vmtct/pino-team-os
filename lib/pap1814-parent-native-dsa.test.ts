/** PAP-1814 — Native BO Parents DSA / SCH-PARENTS-GUARDIANS. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parentNativeModule } from "../app/bo/parents/parent-native-model";
import { loadNativeParentContext, loadNativeParentDirectory,
  projectNativeParent, saveNativeParentName } from "../app/bo/parents/parent-native-data";

const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const other="01a0b29a-3acd-7a18-a0f2-cf6016548ab6";
const parentId="01a1be6d-b06c-7868-be08-bbed0d3a9a8f";
const record={id:parentId,displayName:"QA Parent",version:1,maskedContact:"•••1234",
  linkedStudentCount:1,centers:["Cần Thơ"],createdAt:"2026-11-09T03:50:00.000Z",createdBy:null,
  updatedAt:"2026-11-09T03:50:00.000Z",updatedBy:null,attention:null};
const data=(value:unknown,status=200)=>new Response(JSON.stringify({data:value}),{status});
const directory=(row=record)=>({scopeCenterId:center,total:1,limit:100,offset:0,items:[row]});
const signal=new AbortController().signal;

test("PAP-1814 native Parent route and create avoid active TDD engine",()=>{
  const entry=readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx","utf8");
  const native=readFileSync("app/bo/parents/ParentDirectoryDsa.tsx","utf8");
  const create=readFileSync("app/bo/parents/ParentCreateDrawer.tsx","utf8");
  assert.match(entry,/content=\{<ParentDirectoryDsa \/>\}/);
  assert.doesNotMatch(entry,/import\("\.\.\/\.\.\/parents\/ParentTdd"\)/);
  assert.match(native,/BoDataTable|BoQuickView|DetailFrame|BoParentReadTabs|ParentCreateDrawer/);
  assert.doesNotMatch(native,/TddRegistry|createBoTddAdapter|SurfaceWorkspace|TddRenderer|ParentTdd/);
  assert.doesNotMatch(create,/toLegacyModule|parentSchema|TddRegistry/);
  for(const key of ["createdAt","createdBy","updatedAt","updatedBy"])
    assert.ok(parentNativeModule.fields.some(field=>field.key===key));
});
test("PAP-1814 Core Parent row is versioned, masked with VN audit date, never fake actor",()=>{
  const row=projectNativeParent(record);
  assert.equal(row.id,parentId);assert.equal(row.version,1);
  assert.equal(row.createdAt,"09/11/2026 · 10:50");
  assert.equal(row.createdBy,"—");assert.equal(row.maskedContact,"•••1234");
  for(const patch of [{maskedContact:"1234"},{id:"bad-uuid"},{version:0},
    {createdBy:"invented"},{plaintextContact:"private"},{linkedStudentCount:-1},{updatedAt:"bad"}])
    assert.throws(()=>projectNativeParent({...record,...patch}));
});
test("PAP-1814 require authenticated BO truth and selected authorized Center",async()=>{
  const seen:string[]=[];
  const fetcher:typeof fetch=async input=>{
    const u=String(input);seen.push(u);
    if(u.endsWith("/context"))return data({surface:"BO",entitled:true,userId:"actor",
      permissionKeys:["team.bo.access","identity.parent_directory.view","identity.parent.edit"]});
    if(u.endsWith("/centers"))return data([{id:center,displayName:"Cần Thơ"}]);
    throw Error("unexpected route");
  };
  assert.ok((await loadNativeParentContext(center,signal,fetcher)).has("identity.parent.edit"));
  assert.deepEqual(seen,["/api/bo/context","/api/bo/centers"]);
  await assert.rejects(()=>loadNativeParentContext(other,signal,fetcher));
});
test("PAP-1814 exact Center Directory, no duplicate or cross-Center receipt",async()=>{
  const fetcher:typeof fetch=async input=>{
    assert.match(String(input),new RegExp("centerId="+center));
    return data(directory());
  };
  const rows=await loadNativeParentDirectory(center,signal,fetcher);
  assert.equal(rows.length,1);assert.equal(rows[0].version,1);
  await assert.rejects(()=>loadNativeParentDirectory(center,signal,async()=>data({...directory(),scopeCenterId:other})));
  await assert.rejects(()=>loadNativeParentDirectory(center,signal,async()=>data({...directory(),total:2,items:[record,record]})));
});
test("PAP-1814 name-only PATCH with CAS, strict receipt/readback, no cross-Center write",async()=>{
  let version=1,name="QA Parent";
  const events:{url:string;method:string;body?:unknown}[]=[];
  const fetcher:typeof fetch=async (target,options)=>{
    const url=String(target),method=options?.method??"GET";
    events.push({url,method,body:options?.body?JSON.parse(String(options.body)):undefined});
    if(method==="PATCH"){
      const payload=events.at(-1)?.body as {displayName:string;expectedVersion:number};
      if(payload.expectedVersion!==version)return data({error:"stale"},409);
      name=payload.displayName;version++;
      return data({id:parentId,displayName:name,version,status:"ACTIVE"});
    }
    return data(directory({...record,displayName:name,version}));
  };
  const edited=await saveNativeParentName(center,projectNativeParent(record),"  QA Updated  ",
    new Set(["identity.parent.edit"]),signal,fetcher);
  assert.equal(edited.name,"QA Updated");assert.equal(edited.version,2);
  assert.deepEqual(events.map(e=>e.method),["PATCH","GET"]);
  assert.equal(events[0].url,"/api/bo/identity/parents/"+parentId+"?centerId="+center);
  assert.deepEqual(events[0].body,{displayName:"QA Updated",expectedVersion:1});
  await assert.rejects(()=>saveNativeParentName(center,projectNativeParent(record),"Denied",new Set(),signal,fetcher));
  await assert.rejects(()=>saveNativeParentName(other,projectNativeParent(record),"Denied",
    new Set(["identity.parent.edit"]),signal,fetcher));
});

test("PAP-1814 exact BO Staging Parent PATCH host fence refuses unsupported host, verb and child",async()=>{
  const {decideHostBoundary}=await import("./host-boundary");
  const path="/api/bo/identity/parents/"+parentId;
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,"PATCH"),{action:"next"});
  for(const method of ["GET","POST","PUT","DELETE","OPTIONS","HEAD"])
    assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"not_found"},method);
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","join.pinohouse.art"])
    assert.deepEqual(decideHostBoundary(host,path,"PATCH"),{action:"not_found"},host);
  for(const malformed of [path+"/",path+"/history",path+"/extra",path+"%2fextra",
    "/api/bo/identity/parents/no-uuid","/api/bo/identity/parents/"+parentId+"-extra"])
    assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",malformed,"PATCH"),{action:"not_found"},malformed);
});
