/** PAP-1732 / PAP-1491 SPEC-UNLOCK — strict HO Specialty History contracts. */
import {describe,it} from "node:test";
import assert from "node:assert/strict";
import {projectSpecialtyHistoryPage,readSpecialtyHistory} from "./ho-specialty-v2-history-client";
import {handleHoSpecialtyHistoryRead} from "./ho-specialty-v2-history-facade";
import {BoApiError} from "./bo-api-error";
import {specialtyDefinition,specialtyProvider} from "../app/ho/learning/specialties/schema";
const id=(n:number)=>"01a03c6e-cc58-7d81-ac8e-"+n.toString(16).padStart(12,"0");
const subject={type:"learning_specialty_v2",id:id(1)};
const event=(n:number,action="Lưu trữ")=>({
 id:id(n),occurredAt:"2026-11-09T10:31:"+String(59-n).padStart(2,"0")+".000Z",
 action,outcome:"succeeded",actorId:null,actorLabel:null,before:null,after:null,
 description:null,redacted:true
});
const response=(data:unknown,status=200)=>Response.json({data},{status});
void describe("PAP-1732 SPEC-UNLOCK S1L-A HO History strict redaction",()=>{
 void it("maps only authorized redacted Core lifecycle events to shared TDD History",()=>{
  const v=projectSpecialtyHistoryPage({events:[event(2,"Khôi phục"),event(3)],nextCursor:"2"},subject);
  assert.equal(v.status,"authorized");
  if(v.status!=="authorized")throw Error("never");
  assert.equal(v.events.length,2);
  assert.deepEqual(v.events.map(x=>x.action),["Khôi phục","Lưu trữ"]);
  assert.equal(v.events.every(x=>x.redacted===true&&x.actor==="Đã ẩn"&&x.source==="Core"),true);
  assert.equal(v.nextCursor,"2");
 });
 void it("rejects unknown raw audit fields, actor identity and malformed cursors fail closed",()=>{
  const invalid=[
   {...event(2),actorId:id(7)},
   {...event(2),actorLabel:"Unknown Person"},
   {...event(2),payloadJson:'{"secret":"test"}'},
   {...event(2),redacted:false},
   {...event(2),action:"CUSTOM_UNTRUSTED"},
   {...event(2),outcome:"reported"}
  ];
  for(const raw of invalid)
   assert.throws(()=>projectSpecialtyHistoryPage({events:[raw],nextCursor:null},subject),BoApiError);
  assert.throws(()=>projectSpecialtyHistoryPage({events:[event(2),event(2)],nextCursor:null},subject),BoApiError);
  assert.throws(()=>projectSpecialtyHistoryPage({events:[event(2)],nextCursor:"../raw"},subject),BoApiError);
  assert.throws(()=>projectSpecialtyHistoryPage({events:[event(2)],nextCursor:null,unsafe:true},subject),BoApiError);
  assert.throws(()=>projectSpecialtyHistoryPage({events:[event(2)],nextCursor:null},{type:"student_profile",id:id(3)}),BoApiError);
 });
 void it("fetches exact Founder HO history path only, with bounded cursor",async()=>{
  const calls:{url:string;method:string}[]=[];
  const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   calls.push({url:String(input),method:String(init?.method)});
   return response({events:[event(2)],nextCursor:null});
  }) as typeof fetch;
  const result=await readSpecialtyHistory(fetcher,subject,"3",new AbortController().signal);
  assert.equal(result.status,"authorized");
  assert.deepEqual(calls,[{url:"/api/ho/learning/specialties/"+id(1)+"/history?limit=20&beforeVersion=3",method:"GET"}]);
  await assert.rejects(()=>readSpecialtyHistory(fetcher,subject,"../3",new AbortController().signal),BoApiError);
 });
 void it("server envelope rejects non-200 without pretending History exists",async()=>{
  const fetcher=(async()=>Response.json({error:{code:"HO_ACCESS_DENIED"}},{status:403})) as typeof fetch;
  await assert.rejects(()=>readSpecialtyHistory(fetcher,subject,null,new AbortController().signal),
    (e:unknown)=>e instanceof BoApiError&&e.status===403);
 });
 void it("HO facade refuses non-staging, malformed query before auth",async()=>{
  const url="https://ho.staging.pinohouse.art/api/ho/learning/specialties/"+id(1)+"/history";
  const base={APP_ENV:"production"} as never;
  assert.equal((await handleHoSpecialtyHistoryRead(new Request(url),base,id(1))).status,404);
  const staging={APP_ENV:"staging"} as never;
  assert.equal((await handleHoSpecialtyHistoryRead(new Request(url+"?beforeVersion=bad",{headers:{host:"ho.staging.pinohouse.art"}}),staging,id(1))).status,400);
 });
});

void describe("PAP-1732 S1L-A shared TDD History capability boundary",()=>{
 void it("binds existing History renderer to catalog.learning.view without role expansion",()=>{
  assert.equal(specialtyDefinition.capabilities.history,"catalog.learning.view");
  const owner=specialtyProvider.history;
  assert.equal(owner?.subjectType,"learning_specialty_v2");
  const bind=owner?.bind((async()=>Response.json({})) as typeof fetch,{surface:"HO"});
  assert.equal(bind?.kind,"provider");
  if(!bind||bind.kind!=="provider")throw Error("specialty history provider missing");
  assert.equal(bind.source.permission,"catalog.learning.view");
 });
});
