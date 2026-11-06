import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {billTableRoot as root,billTableCenter,billTableQuery,parseBillTablePage} from "./bo-bill-table-contract";
import {handleBoBillTableRequest} from "./bo-bill-table-handler";
import {loadBoBillTable} from "./bo-bill-table-client";
import {decideHostBoundary} from "./host-boundary";
import {billProvider,billQuery,billTableColumns,projectBillTable} from "../app/bo/bills/schema";
const center="01900000-0000-7000-8000-000000000001",draft="01900000-0000-7000-8000-000000000002",bill="01900000-0000-7000-8000-000000000003";
const at="2026-11-05T01:00:00.000Z",host="bo.staging.pinohouse.art",path=root+"/center/"+center;
const cursor="ISSUED~"+at+"~"+draft;
function row(){return {draftId:draft,billId:bill,centerId:center,billCode:null,billCodeState:"UNAVAILABLE",payerParentUserId:bill,
 payerDisplay:{state:"REDACTED",label:null},distinctStudentCount:1,students:[{studentProfileId:bill,display:{state:"REDACTED",label:null}}],
 studentsTruncated:false,subscriptionLineCount:2,currency:"VND",financialSource:"ISSUED_LEDGER",financialState:"AVAILABLE",
 netAmountMinor:100,collectedAmountMinor:0,balanceMinor:100,status:"OPEN",latestConfirmedPaymentAt:null,createdAt:at,creationSource:"BILL_DRAFT",
 freshness:{draftVersion:2,billVersion:1,transactionCount:0,transactionVersionSum:0,updatedAt:at}};}
function page(items:unknown[]=[row()]){return {items,hasMore:false,nextCursor:null,scopeCenterId:center,coverage:"CENTER_BOUND_DRAFT_ORIGIN_ONLY",snapshot:"SINGLE_SQL_STATEMENT"};}
function req(query="centerId="+center,method="GET",hostname=host,headers:Record<string,string>={}){
 return new Request("https://"+hostname+path+"?"+query,{method,headers:{cookie:"pino_staff_password_session=synthetic",...headers}});
}
function setup(data:unknown=page(),status=200){const calls:unknown[]=[];return {calls,env:{PINO_BO_CORE:{async executeWithStaffPassword(request:unknown,token:string){calls.push(request);assert.equal(token,"synthetic");return {status,body:status===200?{data}:{token:"do-not-echo"},requestId:"synthetic"};}}}};}
test("PAP-1526 exact route and host fence never expands Draft or financial write admission",()=>{
 assert.equal(billTableCenter(path),center);
 for(const suffix of ["","/", "/center/no-uuid","/center/"+center+"/issue","/center/"+center+"/extra","/center/"+"-".repeat(36)]){
  assert.equal(decideHostBoundary(host,root+suffix).action,"not_found");
 }
 assert.equal(decideHostBoundary(host,path).action,"next");
 for(const method of ["POST","PUT","PATCH","DELETE","HEAD","OPTIONS"])assert.equal(decideHostBoundary(host,path,method).action,"not_found");
 for(const foreign of ["ho.staging.pinohouse.art","tos.staging.pinohouse.art","bo.pinohouse.art","evil.invalid"])assert.equal(decideHostBoundary(foreign,path).action,"not_found");
});
test("PAP-1526 query requires exact Center and bounded unique pagination",()=>{
 assert.deepEqual(billTableQuery(new URLSearchParams({centerId:center,limit:"1",after:cursor}),center),{limit:1,after:cursor});
 for(const query of ["",`centerId=${bill}`,`centerId=${center}&centerId=${center}`,`centerId=${center}&limit=0`,`centerId=${center}&limit=101`,
  `centerId=${center}&limit=1.5`,`centerId=${center}&limit=1&limit=2`,`centerId=${center}&after=x`,`centerId=${center}&actor=founder`,
  `centerId=${center}&after=${encodeURIComponent(cursor)}&after=${encodeURIComponent(cursor)}`])assert.equal(billTableQuery(new URLSearchParams(query),center),null,query);
});
test("PAP-1526 authenticated BFF forwards credential privately and explicit resource Center",async()=>{
 const {env,calls}=setup();const result=await handleBoBillTableRequest(req("centerId="+center+"&limit=1&after="+encodeURIComponent(cursor)),env);
 assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"no-store");assert.equal(result.headers.get("access-control-allow-origin"),null);
 assert.deepEqual(calls,[{method:"GET",path:"billing/bill-table/center/"+center+"?"+new URLSearchParams({limit:"1",after:cursor}),resource:{centerId:center}}]);
 assert.doesNotMatch(await result.text(),/synthetic|do-not-echo/);
});
test("PAP-1526 BFF rejects missing auth, foreign host/origin, methods and bad Center before Core",async()=>{
 const {env,calls}=setup();
 assert.equal((await handleBoBillTableRequest(req(undefined,"GET",host,{cookie:""}),env)).status,401);
 assert.equal((await handleBoBillTableRequest(req(undefined,"GET","evil.invalid"),env)).status,404);
 assert.equal((await handleBoBillTableRequest(req(undefined,"GET",host,{host:"evil.invalid"}),env)).status,404);
 assert.equal((await handleBoBillTableRequest(req(undefined,"GET",host,{origin:"https://evil.invalid"}),env)).status,403);
 assert.equal((await handleBoBillTableRequest(req(undefined,"GET",host,{"sec-fetch-site":"cross-site"}),env)).status,403);
 for(const method of ["POST","PATCH","DELETE","HEAD","OPTIONS"])assert.equal((await handleBoBillTableRequest(req(undefined,method),env)).status,405);
 for(const query of ["centerId="+bill,"centerId="+center+"&limit=101","centerId="+center+"&centerId="+center])assert.equal((await handleBoBillTableRequest(req(query),env)).status,400);
 assert.equal(calls.length,0);
});
test("PAP-1526 upstream errors and malformed/foreign/partial data never return successful finance",async()=>{
 for(const status of [401,403,404,409,503]){
  const result=await handleBoBillTableRequest(req(),setup(undefined,status).env);assert.equal(result.status,status);assert.doesNotMatch(await result.text(),/do-not-echo/);
 }
 for(const data of [{},page([{...row(),centerId:bill}]),page([{...row(),balanceMinor:null}]),{...page(),scopeCenterId:bill}])assert.equal((await handleBoBillTableRequest(req(),setup(data).env)).status,502);
});
test("PAP-1526 financial parser accepts Core states, including unavailable Draft snapshot",()=>{
 for(const [status,collected,balance] of [["OPEN",0,100],["PARTIALLY_PAID",30,70],["PAID",100,0],["VOID",0,100]] as const){
  const paid=collected>0;const item={...row(),status,collectedAmountMinor:collected,balanceMinor:balance,latestConfirmedPaymentAt:paid?at:null,
   freshness:{...row().freshness,transactionCount:paid?1:0,transactionVersionSum:paid?1:0}};
  assert.equal(parseBillTablePage(page([item]),center).items[0].status,status);
 }
 const d={...row(),billId:null,status:"DRAFT",financialSource:"DRAFT_SNAPSHOT",freshness:{...row().freshness,billVersion:null}};
 assert.equal(parseBillTablePage(page([d]),center).items[0].netAmountMinor,100);
 assert.equal(parseBillTablePage(page([{...d,financialState:"UNAVAILABLE",netAmountMinor:null,collectedAmountMinor:null,balanceMinor:null}]),center).items[0].balanceMinor,null);
});
test("PAP-1526 parser rejects unknown status, identity enrichment, stale shape and inconsistent ledger",()=>{
 for(const patch of [{status:"ISSUED"},{status:"FUTURE"},{status:["OPEN"]},{financialState:["AVAILABLE"]},{financialSource:"DRAFT_SNAPSHOT"},{financialState:"UNAVAILABLE"},
  {netAmountMinor:null},{collectedAmountMinor:NaN},{balanceMinor:99},{netAmountMinor:Number.MAX_SAFE_INTEGER+1},
  {status:"PAID"},{status:"PARTIALLY_PAID"},{status:"VOID",collectedAmountMinor:1,balanceMinor:99},
  {payerDisplay:{state:"VISIBLE",label:"Unauthorized"}},{billCode:"invented"},{students:[{studentProfileId:bill,display:{state:"REDACTED",label:"secret"}}]},
  {distinctStudentCount:2},{studentsTruncated:true},{creationSource:"BILL"},{latestConfirmedPaymentAt:"invalid"},
  {freshness:{...row().freshness,billVersion:null}},{freshness:{...row().freshness,draftVersion:0}},
  {freshness:{...row().freshness,updatedAt:"2026-11-04T01:00:00.000Z"}}])assert.throws(()=>parseBillTablePage(page([{...row(),...patch}]),center));
 assert.throws(()=>parseBillTablePage(page([row(),row()]),center));
 assert.throws(()=>parseBillTablePage({...page(),hasMore:true,nextCursor:cursor},center));
});
test("PAP-1526 list uses one collection HTTP request, Draft identity and exact ten columns",async()=>{
 let calls=0;const fetcher:typeof fetch=async(input,init)=>{calls++;assert.match(String(input),/bill-table\/center\//);assert.equal(init?.redirect,"error");return Response.json({data:page()});};
 const result=await billProvider.list(billQuery,{surface:"BO",centerId:center},fetcher,new AbortController().signal);
 assert.equal(calls,1);assert.equal(result.records[0].row.id,draft);assert.equal(result.records[0].row.parent,"Đã ẩn");assert.equal(result.records[0].row.students,"Đã ẩn");
 assert.equal(result.records[0].row.code,"Chưa có mã");assert.equal(result.records[0].row.balance,100);
 assert.deepEqual(billTableColumns,["code","parent","students","subscriptionCount","total","collected","balance","status","latestPaymentAt","createdAt"]);
 const parsed=parseBillTablePage(page(),center).items[0];assert.equal(projectBillTable(parsed).id,draft);
});
test("PAP-1526 cap overflow fails explicitly; abort prevents stale A response after Center switch",async()=>{
 const ctl=new AbortController();let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return Response.json({data:{...page(Array.from({length:100},(_,i)=>({...row(),draftId:`01900000-0000-7000-8000-${String(i+100).padStart(12,"0")}`,billId:`01900000-0000-7000-8000-${String(i+300).padStart(12,"0")}`}))),hasMore:true,nextCursor:cursor}});};
 await assert.rejects(loadBoBillTable(center,fetcher),/hơn 100 Bills/);assert.equal(calls,1);
 await assert.rejects(loadBoBillTable(center,async()=>{ctl.abort();return Response.json({data:page()});},ctl.signal),{name:"AbortError"});
 const source=readFileSync("app/bo/bills/BoBillsTdd.tsx","utf8");assert.match(source,/key=\{selected\}/);assert.match(source,/ctl.abort\(\);bound\?\.dispose\(\)/);
 assert.doesNotMatch(source,/<select|boApi\.centers/);
});


test("PAP-1526 only explicit Core VERIFIED identity is displayed, while REDACTED stays hidden",()=>{
 const authorized={...row(),payerDisplay:{state:"VERIFIED",label:"Phụ huynh A"},
  students:[{studentProfileId:bill,display:{state:"VERIFIED",label:"Học viên B"}}]};
 const parsed=parseBillTablePage(page([authorized]),center).items[0]!;
 assert.deepEqual(parsed.payerDisplay,{state:"VERIFIED",label:"Phụ huynh A"});
 assert.deepEqual(parsed.students[0].display,{state:"VERIFIED",label:"Học viên B"});
 assert.equal(projectBillTable(parsed).parent,"Phụ huynh A");
 assert.equal(projectBillTable(parsed).students,"Học viên B");
 const redacted=parseBillTablePage(page([row()]),center).items[0]!;
 assert.equal(projectBillTable(redacted).parent,"Đã ẩn");
 assert.equal(projectBillTable(redacted).students,"Đã ẩn");
});
test("PAP-1526 fails closed on unproven, malformed or forged identity labels",()=>{
 for(const display of [
  {state:"VERIFIED",label:null},{state:"VERIFIED",label:""},
  {state:"VERIFIED",label:" "},{state:"VERIFIED",label:" secret"},
  {state:"VERIFIED",label:"secret "},{state:"VERIFIED",label:"x".repeat(161)},
  {state:"VISIBLE",label:"secret"},{state:"REDACTED",label:"secret"},
  {state:"VERIFIED",label:"line\nsecret"},
 ]){
  assert.throws(()=>parseBillTablePage(page([{...row(),payerDisplay:display}]),center));
  assert.throws(()=>parseBillTablePage(page([{...row(),students:[{studentProfileId:bill,display}]}]),center));
 }
 assert.throws(()=>parseBillTablePage(page([{...row(),centerId:draft,
  payerDisplay:{state:"VERIFIED",label:"Foreign Center Parent"}}]),center));
});
