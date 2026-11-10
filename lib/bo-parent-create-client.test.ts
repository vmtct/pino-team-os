import test from "node:test";
import assert from "node:assert/strict";
import { createStandaloneParent, type BoParentStandaloneCreateInput } from "./bo-parent-create-client";
import { BoApiError } from "./bo-api-error";

const center="0198d050-56c1-7ac5-b9ab-b0e45d912345";
const parentId="0198d050-56c1-7ac5-b9ab-b0e45d954321";
const contactId="0198d050-56c1-7ac5-b9ab-b0e45d966666";
const body:BoParentStandaloneCreateInput={displayName:"Parent One",contacts:[{identifierType:"EMAIL",value:"parent@example.invalid",isPrimary:true}]};
const result={parentUserId:parentId,version:1,createdContactIdentifierIds:[contactId],directoryVisibility:"CENTER_VISIBLE"};

test("PAP-1550 client sends selected Center, key and only canonical Parent data",async()=>{
  const seen: Array<{url:string;init?:RequestInit}>=[];
  const fetcher=(async (url:RequestInfo|URL,init?:RequestInit)=>{seen.push({url:String(url),...(init?{init}:{})});return Response.json({data:result},{status:201});}) as typeof fetch;
  assert.deepEqual(await createStandaloneParent(center,body,"key-1",fetcher),result);
  assert.equal(seen[0]?.url,"/api/bo/identity/parents?centerId="+center);
  assert.equal(seen[0]?.init?.headers && (seen[0]!.init!.headers as Record<string,string>)["idempotency-key"],"key-1");
  assert.deepEqual(JSON.parse(String(seen[0]?.init?.body)),body);
});
test("PAP-1550 client preserves Core denial and structured response",async()=>{
  const fetcher=(async()=>Response.json({error:{message:"Not allowed",requestId:"rejected"}},{status:403})) as typeof fetch;
  await assert.rejects(createStandaloneParent(center,body,"key-2",fetcher),(e:unknown)=>e instanceof BoApiError && e.status===403&&e.structuredResponse);
});
test("PAP-1550 client rejects fabricated success and wrong Center before fetch",async()=>{
  let calls=0;
  const invalid=(async()=>{calls++;return Response.json({data:{...result,directoryVisibility:"LISTED"}});}) as typeof fetch;
  await assert.rejects(createStandaloneParent(center,body,"key-3",invalid),(e:unknown)=>e instanceof BoApiError&&e.status===502);
  await assert.rejects(createStandaloneParent("unscoped",body,"key-3",invalid),(e:unknown)=>e instanceof BoApiError&&e.status===400);
  assert.equal(calls,1);
});
