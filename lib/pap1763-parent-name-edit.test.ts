// PAP-1763 / Epic PAP-1384 SCH-PARENTS-GUARDIANS
// FSG5 name-only FE contract: Core version, exact Center scope, denial, readback.
import test from "node:test";
import assert from "node:assert/strict";
import { parentDefinition, parentProvider, parentQuery } from "@/app/bo/parents/schema";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import { readScopedParentDirectory } from "@/app/bo/parents/provider";
import type { AuthorizationContext } from "@/lib/workspace-schema";
import { readFileSync } from "node:fs";

const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const other="01a0b29a-3acd-7a18-a0f2-cf6016548ab6";
const id="01a1a61c-ab78-7652-bff2-d818a0c96ce4";
const scope={surface:"BO" as const,centerId:center};
const row={id,displayName:"Old Parent",version:1,maskedContact:"p•••@example.invalid",
  linkedStudentCount:1,centers:["PINO Cần Thơ"],createdAt:"2026-11-01T01:00:00Z",
  createdBy:null,updatedAt:"2026-11-01T01:00:00Z",updatedBy:null,attention:null};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
const ctx=(canEdit:boolean):AuthorizationContext=>({surface:"BO",centerId:center,
  authorize:(permission:string)=>canEdit||permission!=="identity.parent.edit"});

test("PAP-1763: only Detail name may edit; Drawer and Table are read-only",()=>{
  assert.equal(parentDefinition.capabilities.edit,"identity.parent.edit");
  assert.equal(parentDefinition.table.inlineEdit.enabled,false);
  assert.deepEqual(parentDefinition.table.inlineEdit.fields,[]);
  assert.deepEqual(parentDefinition.drawer.sections[0].fields.slice(0,4),["name","maskedContact","studentCount","centers"]);
  const name=parentDefinition.fields.find(f=>f.key==="name");
  assert.equal(name?.readOnly,false);
  assert.equal(name?.capabilities.inlineEdit,true);
  for(const field of parentDefinition.fields.filter(f=>f.key!=="name"))assert.notEqual(field.capabilities.inlineEdit,true);
  const source=readFileSync("app/bo/parents/ParentTdd.tsx","utf8");
  assert.match(source,/businessLoaders=\{loaders\} drawerReadOnly/);
  assert.doesNotMatch(source,/inlineEdit.*enabled:\s*true/);
});
test("PAP-1763: Core-owned version is provided to authenticated TDD, invalid version denied",async()=>{
  const fetcher:typeof fetch=async()=>json({data:{scopeCenterId:center,total:1,limit:100,offset:0,items:[row]}});
  const result=await parentProvider.list(parentQuery,scope,fetcher,new AbortController().signal);
  assert.equal(result.records[0]?.version,"1");
  assert.equal(result.records[0]?.row.name,"Old Parent");
  assert.equal((await readScopedParentDirectory(center,fetcher,new AbortController().signal))[0]?.version,1);
  const invalid:typeof fetch=async()=>json({data:{scopeCenterId:center,total:1,limit:100,offset:0,items:[{...row,version:0}]}});
  await assert.rejects(()=>parentProvider.list(parentQuery,scope,invalid,new AbortController().signal));
  const old:typeof fetch=async()=>json({data:{scopeCenterId:center,total:1,limit:100,offset:0,items:[{...row,version:undefined}]}});
  assert.equal((await parentProvider.list(parentQuery,scope,old,new AbortController().signal)).records[0]?.version,undefined,"no invented version");
});
test("PAP-1763: FE mutation exact payload and Core readback, deny unauthorized/editing other fields",async()=>{
  const calls:Array<{method:string;url:string;body:unknown}>=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const url=String(input),method=init?.method??"GET";
    calls.push({method,url,body:init?.body?JSON.parse(String(init.body)):null});
    if(method==="PATCH")return json({data:{id,displayName:"Edited Parent",status:"ACTIVE",version:2}});
    return json({data:{scopeCenterId:center,total:1,limit:100,offset:0,items:[{...row,displayName:"Edited Parent",version:2}]}});
  };
  const writer=parentProvider.mutation?.(fetcher,scope);
  assert.ok(writer);
  const denied=await writer.update(id,{name:"Edited Parent"},"1",ctx(false),new AbortController().signal);
  assert.equal(denied.status,"denied");assert.equal(calls.length,0);
  const extras=await writer.update(id,{status:"ACTIVE"} as never,"1",ctx(true),new AbortController().signal);
  assert.equal(extras.status,"invalid");assert.equal(calls.length,0);
  const saved=await writer.update(id,{name:"Edited Parent"},"1",ctx(true),new AbortController().signal);
  assert.equal(saved.status,"saved");
  if(saved.status!=="saved")throw Error("save failed");
  assert.equal(saved.version,"2");assert.equal(saved.row.name,"Edited Parent");
  assert.equal(parentProvider.mutationCenter?.(saved.row),center);
  assert.deepEqual(calls[0],{method:"PATCH",
    url:"/api/bo/identity/parents/"+id+"?centerId="+center,
    body:{displayName:"Edited Parent",expectedVersion:1}});
  assert.equal(calls[1]?.method,"GET");
  assert.equal(calls.length,2);
});
test("PAP-1763: BO proxy accepts ONLY the exact Parent name/CAS path and selected Center",async()=>{
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);
    return {status:200,body:{data:{id,displayName:"Edited Parent",status:"ACTIVE",version:2}},requestId:"parent-edit"};}};
  const env:BoWriteEnv={PINO_BO_CORE:binding},path="identity/parents/"+id;
  const req=(query:string,body:unknown,method="PATCH",cookie=true)=>new Request("https://bo.staging.pinohouse.art/api/bo/"+path+query,{
    method,headers:{"content-type":"application/json",...(cookie?{cookie:"pino_staff_password_session=local-password-session"}:{})},
    body:JSON.stringify(body),
  });
  const body={displayName:"Edited Parent",expectedVersion:1};
  assert.equal((await handleBoWriteRequest(req("?centerId="+center,body),env,path)).status,200);
  assert.deepEqual(forwarded,[{method:"PATCH",path,body,resource:{centerId:center}}]);
  for(const [query,bad] of [["",body],["?centerId="+center+"&centerId="+other,body],
    ["?centerId="+center,{...body,status:"ACTIVE"}],
    ["?centerId="+center,{...body,expectedVersion:0}] ] as const){
    assert.equal((await handleBoWriteRequest(req(query,bad),env,path)).status,400);
  }
  assert.equal(forwarded.length,1);
  assert.equal((await handleBoWriteRequest(req("?centerId="+center,body,"PATCH",false),env,path)).status,401);
  assert.equal(forwarded.length,1);
});
