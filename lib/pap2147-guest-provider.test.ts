import assert from "node:assert/strict";
import test from "node:test";
import {createGuest,guestProvider,mapGuest} from "../app/bo/mytime-guests/provider";
import {queryDefault} from "../app/bo/mytime-guests/schema";
const c="019d2144-0000-7000-8000-000000000001",b="019d2144-0000-7000-8000-000000000002",g="019d2144-0000-7000-8000-000000000003",p="019d2144-0000-7000-8000-000000000004";
const at="2026-11-18T08:00:00.000Z",guest={id:g,personId:p,centerId:c,centerName:"QA Center",name:"QA",gender:"FEMALE",phone:"0900000001",birthDate:null,email:null,note:null,version:1,createdAt:at,updatedAt:at,createdBy:null,updatedBy:null};
const scope={surface:"BO",centerId:c} as const,signal=()=>new AbortController().signal,context={...scope,authorize:()=>true};
const reply=(data:unknown,status=200)=>Response.json({data},{status});
test("PAP-2147 map only scoped canonical primitive",()=>{
 const mapped=mapGuest(guest,c);assert.equal(mapped.row.center,"QA Center");assert.equal(mapped.row.gender,"Nữ");assert.equal(mapped.row.createdBy,null);assert.equal(mapped.version,"1");
 assert.throws(()=>mapGuest({...guest,centerId:b},c));assert.throws(()=>mapGuest({...guest,gender:"OTHER"},c));assert.throws(()=>mapGuest({...guest,version:0},c));assert.equal(mapGuest({...guest,gender:null,name:null},c).row.gender,null);
});
test("PAP-2147 list scope receipt and detail identity checked",async()=>{
 const provider=guestProvider();
 const actual=await provider.list(queryDefault,scope,async input=>{assert.match(String(input),/centerId=/);return reply({scopeCenterId:c,guests:[guest],nextBeforeId:null});},signal());
 assert.equal(actual.total,1);
 await assert.rejects(provider.list(queryDefault,scope,async()=>reply({scopeCenterId:b,guests:[],nextBeforeId:null}),signal()));
 await assert.rejects(provider.list(queryDefault,scope,async()=>reply({scopeCenterId:c,guests:[guest,guest],nextBeforeId:null}),signal()));
 await assert.rejects(provider.detail(g,scope,async()=>reply({...guest,id:p}),signal()));
});
test("PAP-2147 create exact idempotency and gender mapping",async()=>{
 const input={name:"QA",gender:"Nữ",phone:"0900000001",birthDate:"",email:"",note:""};
 const actual=await createGuest(c,input,"test-guest-0000000001",async(input,init)=>{
  assert.equal(String(input),"/api/bo/identity/mytime-guests?centerId="+c);assert.equal(init?.method,"POST");assert.equal(new Headers(init?.headers).get("idempotency-key"),"test-guest-0000000001");
  assert.deepEqual(JSON.parse(String(init?.body)),{name:"QA",gender:"FEMALE",phone:"0900000001",birthDate:null,email:null,note:null});return reply({guest,committedVersion:1,replayed:false},201);
 },signal());assert.equal(actual.row.id,g);
 await assert.rejects(createGuest(c,{...input,name:""},"test-guest-0000000002",async()=>{throw Error("must not call");},signal()));
});
test("PAP-2147 CAS retry retains same key on transport error",async()=>{
 const provider=guestProvider(),keys:string[]=[];let attempts=0;
 const adapter=provider.mutation!(async(_input,init)=>{
  keys.push(new Headers(init?.headers).get("idempotency-key")!);assert.deepEqual(JSON.parse(String(init?.body)),{name:"Changed",expectedVersion:1});
  if(++attempts===1)throw Error("uncertain network");
  return reply({guest:{...guest,name:"Changed",version:2},committedVersion:2,replayed:true});
 },scope);
 await assert.rejects(adapter.update(g,{name:"Changed"},"1",context,signal()));
 const saved=await adapter.update(g,{name:"Changed"},"1",context,signal());assert.equal(saved.status,"saved");assert.equal(keys[0],keys[1]);
 const denied=await adapter.update(g,{name:"Changed"},"1",{...scope,authorize:()=>false},signal());assert.equal(denied.status,"denied");
});
test("PAP-2147 history is subject-specific and redacted",async()=>{
 const history=guestProvider().history!.bind(async()=>reply({scopeCenterId:c,events:[{id:p,occurredAt:at,action:"identity.mytime_guest_created",actorName:null,actorType:"user"}]}),scope);
 assert.equal(history.kind,"provider");if(history.kind!=="provider")throw Error();
 const result=await history.load({type:"mytime_guest",id:g},context,null,signal());assert.equal(result.status,"authorized");
 assert.equal((await history.load({type:"person",id:g},context,null,signal())).status,"denied");
});
