import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HO_BILLS_API as api,canVoidBill,isHoBillsRequest,parseBillVoid,parseHoBill} from "./ho-bills-contract";
import {handleHoBills,type HoBillsEnv} from "./ho-bills-facade";
import {loadBill,loadBills,voidBill} from "./ho-bills-client";
import {decideHostBoundary,HO_STAGING_HOSTNAME as host} from "./host-boundary";
import {surfaceSession} from "./workspace-adapters/session";
import {TddRegistry,composeTabs} from "./workspace-schema";
import {billDefinition,billFields,billProvider,billQuery,billRow,verifyBillExtension} from "../app/ho/billing/bills/schema";
import {latestBillPayment} from "./bill-table-presentation";
import {HO_PAGE_PATHS,safeHoReturnTo} from "./ho-routes";
const id="01900000-0000-7000-8000-000000000001";
const other="01900000-0000-7000-8000-000000000002";
const at="2026-11-04T01:00:00Z";
function sample() {return {
  bill:{id,payerParentUserId:other,currency:"VND",billDiscountMinor:0,dueOn:null,campaignReference:null,voidedAt:null as string|null,createdAt:at,updatedAt:at,version:1},
  items:[{id:other,billId:id,studentProfileId:other,subscriptionId:other,productPlanId:other,quantity:1,unitPriceMinor:3900000,discountAmountMinor:0,descriptionSnapshot:"12 tuần",createdAt:at}],
  specialtyItems:[],walkinItems:[],transactions:[] as unknown[],grossAmountMinor:3900000,itemDiscountMinor:0,netAmountMinor:3900000,
  collectedAmountMinor:0,balanceMinor:3900000,paymentState:"OPEN",isOverdue:false,
  history:[{occurredAt:at,actorType:"founder",actorId:other,action:"billing.bill_voided",outcome:"succeeded",payloadJson:JSON.stringify({reason:"Duplicate",private:"hidden"})}],
};}
function transaction(status="CONFIRMED",kind="PAYMENT") {return {id:other,billId:id,transactionKind:kind,amountMinor:100,
  occurredAt:at,method:"CASH",reference:null,note:null,status,createdAt:at,updatedAt:at,version:1};}
const command={expectedVersion:1,reason:" Duplicate ",confirmed:true};
function req(suffix="",method="GET",body:unknown=command,headers:Record<string,string>={}) {
  return new Request("https://"+host+api+suffix,{method,headers:{host,cookie:"pino_staff_password_session=valid",
    origin:"https://"+host,"content-type":"application/json","idempotency-key":"bill-void-test-key",...headers},
    ...(method==="POST"?{body:JSON.stringify(body)}:{})});
}
function setup(user="founder",admitted=true,upstream=200) {
  const calls:{method:string;path:string;body?:unknown;idempotencyKey?:string}[]=[];
  const env:HoBillsEnv={APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"founder,manager,staff",PINO_BO_CORE:{
    async executeWithStaffPassword(request,token) {
      if(token!=="valid")return {status:401,body:{},requestId:"test"};
      return {status:request.path==="ho/admission"&&!admitted?403:200,requestId:"test",body:{data:request.path==="ho/admission"
        ?{admitted}: {userId:user,email:"synthetic@example.invalid",surface:"BO",entitled:true,permissionKeys:["team.bo.access"]}}};
    }},PINO_CORE:{async executeWithStaffPassword(request,token){
      assert.equal(token,"valid"); calls.push(request);
      const b=sample(); if(request.method==="POST"){b.bill.voidedAt=at;b.bill.version=2;b.paymentState="VOID";}
      return {status:upstream,body:{data:request.path==="billing/bills"?[b]:b},requestId:"test"};
    }}};
  return {env,calls};
}
test("PAP-1422 narrow HO-only route/verb manifest, no BO Void or neighboring writes",()=>{
  assert.equal(HO_PAGE_PATHS.bills,"/ho/billing/bills");
  assert.equal(safeHoReturnTo(HO_PAGE_PATHS.bills+"?record="+id),HO_PAGE_PATHS.bills+"?record="+id);
  for(const [path,method] of [[api,"GET"],[api+"/"+id,"GET"],[api+"/"+id+"/void","POST"]]){
    assert.equal(isHoBillsRequest(path!,method!),true);
    assert.equal(decideHostBoundary(host,path!,method!).action,"next");
    for(const foreign of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","localhost","evil.invalid"])
      assert.equal(decideHostBoundary(foreign,path!,method!).action,"not_found");
  }
  for(const suffix of ["/","/bad","/"+id+"/issue","/"+id+"/payments","/"+id+"/void/extra"])
    for(const method of ["GET","POST","PUT","DELETE"])assert.equal(isHoBillsRequest(api+suffix,method),false);
  for(const method of ["POST","PUT","PATCH","DELETE","HEAD"])assert.equal(isHoBillsRequest(api,method),false);
});
test("PAP-1422 exact financial projection, audit redaction, malformed source fails closed",()=>{
  const b=parseHoBill(sample(),true);
  assert.equal(b.history?.[0].reason,"Duplicate");
  assert.doesNotMatch(JSON.stringify(b),/private|payloadJson|hidden/);
  assert.deepEqual(parseHoBill(b,true),b);
  for(const patch of [{bill:{}},{items:[]},{transactions:[transaction("UNKNOWN")]},{netAmountMinor:-1},
    {grossAmountMinor:1.2},{specialtyItems:[{}]},{history:[{}]},{items:[sample().items[0],sample().items[0]]}])
    assert.throws(()=>parseHoBill({...sample(),...patch},true));
});
test("PAP-1422 unpaid-only guard includes net-zero confirmed payments/refunds",()=>{
  assert.equal(canVoidBill(parseHoBill(sample())),true);
  for(const paymentState of ["PAID","PARTIALLY_PAID","VOID"])assert.equal(canVoidBill(parseHoBill({...sample(),paymentState})),false);
  for(const transactionKind of ["PAYMENT","REFUND"])assert.equal(canVoidBill(parseHoBill({...sample(),transactions:[transaction("CONFIRMED",transactionKind)]})),false);
  assert.equal(canVoidBill(parseHoBill({...sample(),bill:{...sample().bill,voidedAt:at}})),false);
});
test("PAP-1422 exact Void payload requires explicit confirm/reason/version",()=>{
  assert.deepEqual(parseBillVoid(command),{...command,reason:"Duplicate"});
  for(const v of [null,{}, {...command,reason:" "},{...command,confirmed:false},{...command,confirmed:"true"},
    {...command,expectedVersion:0},{...command,expectedVersion:1.2},{...command,reason:"x".repeat(501)}, {...command,actorId:id}])assert.equal(parseBillVoid(v),null);
});
test("PAP-1422 proxy forwards only authenticated private Founder list/detail/Void",async()=>{
  const {env,calls}=setup();
  for(const suffix of ["","/"+id]){
    const response=await handleHoBills(req(suffix),env);assert.equal(response.status,200);
    assert.equal(response.headers.get("cache-control"),"no-store");
    assert.doesNotMatch(await response.text(),/payloadJson|hidden/);
  }
  assert.equal((await handleHoBills(req("/"+id+"/void","POST"),env)).status,200);
  assert.deepEqual(calls.map(c=>[c.method,c.path]),[["GET","billing/bills"],["GET","billing/bills/"+id],["GET","billing/bills/"+id],["POST","billing/bills/"+id+"/void"]]);
  assert.deepEqual(calls.at(-1)?.body,{expectedVersion:1,reason:"Duplicate",confirmed:true});
  assert.equal(calls.at(-1)?.idempotencyKey,"bill-void-test-key");
});
test("PAP-1422 missing/forged session, Manager/Staff and revoked Founder cannot read or Void",async()=>{
  for(const suffix of ["","/"+id,"/"+id+"/void"]){
    const method=suffix.endsWith("void")?"POST":"GET";
    for(const user of ["manager","staff","founder"]){
      const {env,calls}=setup(user,false);
      assert.equal((await handleHoBills(req(suffix,method),env)).status,403);assert.equal(calls.length,0);
    }
    for(const cookie of ["","pino_staff_password_session=forged"]){
      const {env,calls}=setup();
      assert.equal((await handleHoBills(req(suffix,method,command,{cookie,"x-founder-id":"founder"}),env)).status,401);
      assert.equal(calls.length,0);
    }
  }
});
test("PAP-1422 proxy rejects cross-origin, wrong host/environment, bad body/key before financial calls",async()=>{
  const {env,calls}=setup();const suffix="/"+id+"/void";
  assert.equal((await handleHoBills(req(suffix,"POST",command,{origin:"https://evil.invalid"}),env)).status,403);
  assert.equal((await handleHoBills(req(suffix,"POST",command,{host:"bo.staging.pinohouse.art"}),env)).status,404);
  assert.equal((await handleHoBills(req(suffix,"POST",command,{"idempotency-key":""}),env)).status,400);
  assert.equal((await handleHoBills(req(suffix,"POST",{...command,confirmed:false}),env)).status,400);
  assert.equal((await handleHoBills(req(),{...env,APP_ENV:"production"})).status,404);
  assert.equal((await handleHoBills(req("?actor=founder"),env)).status,404);
  assert.equal(calls.length,0);
});
test("PAP-1422 stale/paid/partial/voided and upstream 403/409 never yield financial success",async()=>{
  for(const patch of [{bill:{...sample().bill,version:2}},{paymentState:"PAID"},{paymentState:"PARTIALLY_PAID"},
    {paymentState:"VOID"},{transactions:[transaction()]}]){
    const {env}=setup();let writes=0;
    env.PINO_CORE={async executeWithStaffPassword(r){if(r.method==="POST")writes++;return {status:200,body:{data:{...sample(),...patch}},requestId:"t"};}};
    assert.equal((await handleHoBills(req("/"+id+"/void","POST"),env)).status,409);assert.equal(writes,0);
  }
  for(const status of [403,409,503])assert.equal((await handleHoBills(req(),setup("founder",true,status).env)).status,status);
  const {env}=setup();env.PINO_CORE={async executeWithStaffPassword(){return {status:200,body:{data:{}},requestId:"t"};}};
  assert.equal((await handleHoBills(req(),env)).status,502);
});
test("PAP-1422 client rejects identity mismatch, 403/409 and unconfirmed Void receipts",async()=>{
  assert.deepEqual(await loadBills(async()=>Response.json({data:[]}),new AbortController().signal),[]);
  await assert.rejects(loadBill(other,async()=>Response.json({data:sample()})),/identity mismatch/);
  for(const status of [403,409])await assert.rejects(loadBill(id,async()=>new Response(null,{status})),{status});
  let writes=0;
  const fetcher:typeof fetch=async(_input,init)=>{writes++;assert.equal(init?.redirect,"error");assert.equal(init?.credentials,"same-origin");
    assert.deepEqual(JSON.parse(String(init?.body)),{expectedVersion:1,reason:"Duplicate",confirmed:true});return Response.json({data:sample()});};
  await assert.rejects(voidBill(parseHoBill(sample()),"Duplicate","bill-test-key",fetcher),/Chưa xác minh/);
  assert.equal(writes,1);
  await assert.rejects(voidBill(parseHoBill({...sample(),paymentState:"PAID"}),"Duplicate","bill-test-key",fetcher),{status:400});
  assert.equal(writes,1);
});
test("PAP-1422 shared TDD admits exact Bills reads without a write aperture",async()=>{
  const calls:string[]=[];
  const s=surfaceSession("HO","https://"+host,async input=>{calls.push(String(input));return Response.json({data:[]});});
  try {
    await s.transport(api);await s.transport(api+"/"+id);
    for(const path of [api,api+"/"+id+"/void",api+"/"+id+"/issue"])await assert.rejects(s.transport(path,{method:"POST"}));
    await assert.rejects(s.transport("https://evil.invalid"+api));await assert.rejects(s.transport(api+"?actor=founder"));
    assert.equal(calls.length,2);
  } finally {s.dispose();}
});
test("PAP-1422 real shared schema, prototype column widths, tabs and source-owned history",async()=>{
  const registry=new TddRegistry(verifyBillExtension);
  const schema=registry.register({...billDefinition,data:{id:"test-bills",list:async()=>({rows:[],total:0}),detail:async()=>null}});
  assert.deepEqual(composeTabs(schema).map(t=>t.id),["overview","subscriptions","payments","history"]);
  assert.deepEqual(billFields.map(f=>f.width),[175,190,190,170,140,160,155,155,130,170,135]);
  assert.equal(schema.table.inlineEdit.enabled,false);assert.equal(billProvider.mutation,undefined);
  const history=billProvider.history!.bind(async()=>Response.json({data:sample()}),{surface:"HO"});
  assert.equal(history.kind,"provider");
  if(history.kind==="provider"){
    const result=await history.load({type:"bill",id},{surface:"HO",authorize:()=>true},null,new AbortController().signal);
    assert.equal(result.status,"authorized");
    if(result.status==="authorized"){assert.equal(result.events[0].actor,"founder · "+other);assert.equal(result.events[0].at,at);}
  }
  const rows=await billProvider.list(billQuery,{surface:"HO"},async()=>Response.json({data:[sample()]}),new AbortController().signal);
  assert.equal(rows.records[0].row.center,null);assert.equal(rows.records[0].row.status,"OPEN");
  const page=readFileSync("app/ho/billing/bills/HoBillsTdd.tsx","utf8");
  const domain=readFileSync("app/ho/billing/bills/BillDomain.tsx","utf8");
  assert.match(page,/SurfaceWorkspace/);assert.match(page,/HoWorkspace module="bills"/);
  assert.doesNotMatch(page+domain,/localStorage|sessionStorage|\.css["'].*bills|window\.prompt/);
  assert.match(domain,/writing\.current=true/);assert.match(domain,/setLocked\(true\)/);
});

test("PAP-1422 cross-surface changed security dependency has exact owner reference",()=>{
  const manifest=JSON.parse(readFileSync("config/tdd-admission.json","utf8"));
  const bo=manifest.modules.find((m:{surface:string;key:string})=>m.surface==="BO"&&m.key==="bills");
  assert.ok(bo);
  for(const file of ["lib/ho-routes.ts","lib/workspace-adapters/session.ts"]){
    assert.deepEqual(bo.externalReferences.filter((r:{file:string})=>r.file===file),[{file,owner:"PAP-1221"}]);
  }
});

test("PAP-1422 eleven ordered columns expose only authorized summary facts",()=>{
 assert.deepEqual(billFields.map(f=>f.label),["Bill","Phụ huynh","Học viên","Center","Subscriptions","Tổng","Đã thu","Còn lại","Trạng thái","Ngày thu gần nhất","Ngày tạo"]);
 const parsed=parseHoBill(sample()),r=billRow(parsed);
 assert.equal(r.name,"Chưa có mã");assert.equal(r.payer,"Đã ẩn");assert.equal(r.students,"Đã ẩn");assert.equal(r.center,null);
 assert.equal(r.subscriptionCount,"1");assert.equal(r.status,"OPEN");assert.equal(r.createdAt,at);assert.equal(r.latestPaymentAt,null);
 assert.equal(r.totalView,new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(3900000));
 for(const state of ["OPEN","PARTIALLY_PAID","PAID","VOID"] as const)assert.equal(billRow({...parsed,paymentState:state}).status,state);
});

test("PAP-1422 latest collection uses confirmed PAYMENT occurrence only, never refund or Void",()=>{
 const entries=[{transactionKind:"PAYMENT",status:"CONFIRMED",occurredAt:"2026-11-04T10:00:00+07:00"},
  {transactionKind:"PAYMENT",status:"CONFIRMED",occurredAt:"2026-11-04T04:00:00Z"},
  {transactionKind:"REFUND",status:"CONFIRMED",occurredAt:"2026-11-06T04:00:00Z"},
  {transactionKind:"PAYMENT",status:"VOID",occurredAt:"2026-11-07T04:00:00Z"}];
 assert.equal(latestBillPayment(entries),"2026-11-04T04:00:00.000Z");
 assert.equal(latestBillPayment(entries.slice(2)),null);
 assert.throws(()=>latestBillPayment([{...entries[0],occurredAt:"invalid"}]));
 assert.equal(latestBillPayment([]),null);
});
