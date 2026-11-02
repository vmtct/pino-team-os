import test from "node:test";
import assert from "node:assert/strict";
import { staffRateProvider } from "../app/ho/staff/staff-rate-provider";
import type { BusinessFormRequest } from "../app/components/workspace-renderer/Slots";

const staff="00000000-0000-4000-8000-000000000099";
const request: BusinessFormRequest={
  surface:"HO", moduleKey:"staffs", slotId:"staff-rate", sourceAdapter:"salary.staff-rate",
  recordId:staff,subject:{type:"staffs",id:staff},principalId:"00000000-0000-4000-8000-000000000019",
  context:{surface:"HO",authorize:()=>false},
};
async function mockFetch<T>(replacement: typeof fetch, action:()=>Promise<T>):Promise<T>{
  const prior=globalThis.fetch;globalThis.fetch=replacement;
  try{return await action();}finally{globalThis.fetch=prior;}
}
test("PAP-1108 private salary provider denies malformed subject before network",async()=>{
  let called=false;
  await mockFetch(async()=>{called=true;throw Error("unexpected fetch");},async()=>{
    await assert.rejects(staffRateProvider.load({...request,subject:{type:"staffs",id:"bad"}},new AbortController().signal),/Invalid HO Staff Rate binding/);
  });
  assert.equal(called,false);
});
test("PAP-1108 projection reads genuine BFF history with four canonical columns and blank form",async()=>{
  let path="";
  const response={data:[{id:"00000000-0000-4000-8000-000000000011",staffMemberId:staff,effectiveFrom:"2026-10-01",periodUntilExclusive:null,amountMinor:32000,currency:"VND",note:"Annual review"}]};
  const result=await mockFetch(async(input,init)=>{path=String(input);assert.equal(init?.method,"GET");return Response.json(response);},()=>staffRateProvider.load(request,new AbortController().signal));
  assert.match(path,/^\/api\/ho\/staff\//);
  assert.equal(result.status,"authorized");
  if(result.status!=="authorized")return;
  assert.deepEqual(Object.keys(result.values),["amount","effectiveDate","reason"]);
  assert.equal(result.values.amount,null);
  assert.equal(result.records?.columns.length,4);
  assert.equal(result.records?.rows.length,1);
  assert.match(String(result.records?.rows[0]?.values.amount),/₫\/giờ/);
});
test("PAP-1108 no saved claim for denied private read or POST",async()=>{
  const read=await mockFetch(async()=>new Response(null,{status:403}),()=>staffRateProvider.load(request,new AbortController().signal));
  assert.deepEqual(read,{status:"denied"});
  const values={amount:32000,effectiveDate:"2026-11-01",reason:"Test only"};
  const write=await mockFetch(async()=>new Response(null,{status:403}),()=>staffRateProvider.submit(request,values,new AbortController().signal));
  assert.deepEqual(write,{status:"denied"});
});
test("PAP-1108 validates salary inputs and POST payload with private BFF contract",async()=>{
  let called=false;
  await mockFetch(async()=>{called=true;throw Error("unexpected fetch");},async()=>{
    assert.deepEqual(await staffRateProvider.submit(request,{amount:0,effectiveDate:"2026-02-30",reason:""},new AbortController().signal),{status:"invalid",fields:["amount","effectiveDate","reason"]});
  });
  assert.equal(called,false);
  const result=await mockFetch(async(_input,init)=>{
    assert.equal(init?.method,"POST");
    assert.equal(new Headers(init?.headers).get("content-type"),"application/json");
    const body=JSON.parse(String(init?.body)) as {amountMinor:number;effectiveFrom:string;note:string};
    assert.deepEqual(body,{amountMinor:32000,effectiveFrom:"2026-11-01",note:"Test only"});
    return new Response(null,{status:201});
  },()=>staffRateProvider.submit(request,{amount:32000,effectiveDate:"2026-11-01",reason:" Test only "},new AbortController().signal));
  assert.deepEqual(result,{status:"saved",message:"Đã lưu mức lương."});
});


test("PAP-1108 rejects contradictory private rate history rather than displaying wrong periods",async()=>{
  const id1="00000000-0000-4000-8000-000000000011";
  const id2="00000000-0000-4000-8000-000000000012";
  const base={staffMemberId:staff,amountMinor:32000,currency:"VND",note:"Fixture"};
  const good=[
    {...base,id:id1,effectiveFrom:"2026-10-01",periodUntilExclusive:null},
    {...base,id:id2,effectiveFrom:"2026-08-01",periodUntilExclusive:"2026-10-01"},
  ];
  const load=(rows:unknown[])=>mockFetch(async()=>Response.json({data:rows}),()=>staffRateProvider.load(request,new AbortController().signal));
  const ok=await load([...good].reverse());
  assert.equal(ok.status,"authorized");
  if(ok.status==="authorized") {
    assert.equal(ok.records?.rows.length,2);
    assert.equal(ok.records?.rows[0]?.values.effectiveUntil,"—");
    assert.equal(ok.records?.rows[1]?.values.effectiveUntil,"30/09/2026");
  }
  for(const rows of [
    [good[0],{...good[1],periodUntilExclusive:"2026-09-01"}],
    [good[0],{...good[1],effectiveFrom:"2026-10-01"}],
    [good[0],{...good[1],id:id1}],
    [{...good[0],staffMemberId:"00000000-0000-4000-8000-000000000002"}],
  ]) await assert.rejects(load(rows),/Invalid (private rate response|rate ledger)/);
});


test("PAP-1108 denied and invalid writes never report saved",async()=>{
  for(const status of [401,403,404]) {
    const denied=await mockFetch(async()=>new Response(null,{status}),
      ()=>staffRateProvider.submit(request,{amount:32000,effectiveDate:"2026-11-01",reason:"Test"},new AbortController().signal));
    assert.deepEqual(denied,{status:"denied"});
  }
  const invalid=await mockFetch(async()=>new Response(null,{status:409}),
    ()=>staffRateProvider.submit(request,{amount:32000,effectiveDate:"2026-11-01",reason:"Test"},new AbortController().signal));
  assert.deepEqual(invalid,{status:"invalid",fields:["effectiveDate"]});
  await mockFetch(async()=>new Response(null,{status:503}),async()=>
    assert.rejects(staffRateProvider.submit(request,{amount:32000,effectiveDate:"2026-11-01",reason:"Test"},new AbortController().signal),/Rate save unavailable/));
});
test("PAP-1108 abort after response prevents displaying private rate history",async()=>{
  const controller=new AbortController();
  await mockFetch(async()=>{controller.abort();return Response.json({data:[]});},async()=>
    assert.rejects(staffRateProvider.load(request,controller.signal),err=>err instanceof Error&&err.name==="AbortError"));
});
test("PAP-1108 private read rejects malformed response without exposing values",async()=>{
  await mockFetch(async()=>Response.json({data:{amountMinor:32000}}),async()=>
    assert.rejects(staffRateProvider.load(request,new AbortController().signal),/Invalid private rate response/));
  await mockFetch(async()=>new Response(null,{status:503}),async()=>
    assert.rejects(staffRateProvider.load(request,new AbortController().signal),/Rate history unavailable/));
});
