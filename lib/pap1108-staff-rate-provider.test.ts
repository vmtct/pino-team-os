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
