import assert from "node:assert/strict";
import test from "node:test";
import {validateProductAdjustmentCommand,handleProductAdjustmentCommand} from "./bo-payroll-adjustment-command";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
import {handleBoPayrollPeriodRequest,type BoPayrollPeriodEnv} from "./bo-payroll-period-handler";
import type {BoAccessRequest} from "./bo-core";

const center="0199f001-0000-7000-8000-000000000002";
const period="0199f001-0000-7000-8000-000000000003";
const staff="0199f001-0000-7000-8000-000000000004";
const fingerprint="a".repeat(64);
const path="workforce/payroll/periods/"+period+"/staff/"+staff+"/financial-adjustments";
const corePath="workforce/payroll/periods/"+period+"/staff/"+staff+"/adjustments";
const origin="https://"+BO_STAGING_HOSTNAME;
const url=origin+"/api/bo/"+path+"?centerId="+center;
const body={centerId:center,amountMinor:-1000,reason:"  Synthetic deduction  ",expectedFingerprint:fingerprint};
const key="pay-adjust-"+fingerprint+":synthetic-123";
const headers={origin,"content-type":"application/json","idempotency-key":key};
const req=(input:unknown=body,opts:{url?:string;method?:string;headers?:Record<string,string>}={})=>new Request(opts.url??url,{method:opts.method??"POST",headers:{...headers,...opts.headers},...(opts.method==="GET"?{}:{body:JSON.stringify(input)})});
const parse=(r:Request,p=path,env="staging")=>validateProductAdjustmentCommand(r,env,p);
test("PAP-1956 product validation forwards exact bounded confirmed signed adjustment only",async()=>{
 assert.deepEqual(await parse(req()),{ok:true,outbound:{method:"POST",path:corePath+"?centerId="+center,resource:{centerId:center},idempotencyKey:key,body:{...body,reason:"Synthetic deduction"}}});
});
test("PAP-1956 rejects invalid host, path, environment, method and fixed E2E aperture",async()=>{
 for(const r of [req(body,{url:url.replace(origin,"https://other.invalid")}),req(body,{headers:{host:"other.invalid"}}),req(body,{url:url.replace("https:","http:")}),req(body,{url:url.replace("/financial-adjustments","/financial-adjustments/extra")})])assert.deepEqual(await parse(r),{ok:false,status:404});
 assert.deepEqual(await parse(req(),path,"production"),{ok:false,status:404});
 assert.deepEqual(await parse(req(body,{method:"GET"})),{ok:false,status:405});
 assert.deepEqual(await parse(req(body,{url:origin+"/api/bo/"+corePath+"?centerId="+center}),corePath),{ok:false,status:404});
 const fixed="workforce/payroll/periods/01a171ed-eb78-7941-b1de-dd4c020457b7/staff/01a18a28-6d8e-7db7-acbb-a18a942a5e72/financial-adjustments";
 assert.deepEqual(await parse(req(body,{url:origin+"/api/bo/"+fixed+"?centerId="+center}),fixed),{ok:false,status:404});
});
test("PAP-1956 rejects malformed scope, fingerprint, key, money and extra properties before forwarding",async()=>{
 for(const bad of [{...body,centerId:staff},{...body,amountMinor:0},{...body,amountMinor:1.5},{...body,amountMinor:1e13},{...body,reason:"x"},{...body,reason:"x".repeat(501)},{...body,expectedFingerprint:"bad"},{...body,category:"other"},{...body,reversesAdjustmentId:staff},null,[]])assert.deepEqual(await parse(req(bad)),{ok:false,status:400});
 for(const u of [url+"&centerId="+center,url+"&extra=1",url.replace(center,"not-a-center")])assert.deepEqual(await parse(req(body,{url:u})),{ok:false,status:400});
 assert.deepEqual(await parse(req(body,{headers:{"idempotency-key":"pay-adjust-"+"b".repeat(64)+":synthetic-123"}})),{ok:false,status:400});
 assert.deepEqual(await parse(req(body,{headers:{origin:"https://other.invalid"}})),{ok:false,status:403});
 assert.deepEqual(await parse(req(body,{headers:{"content-type":"text/plain"}})),{ok:false,status:403});
});
test("PAP-1956 prepared command denies unauthenticated or missing permission and retains Core Center/Founder denial",async()=>{
 const calls:BoAccessRequest[]=[];
 const rights=["payroll.period.view","payroll.settlement.view","payroll.settlement.manage"];
 let keys=rights,commandStatus=403;
 const env={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(r:BoAccessRequest,token:string){
  assert.equal(token,"synthetic-only");
  calls.push(r);
  if(r.path==="context")return {status:200,requestId:"ctx",body:{data:{userId:"synthetic",email:"a@example.invalid",surface:"BO",entitled:true,permissionKeys:keys}}};
  return {status:commandStatus,requestId:"receipt",body:commandStatus===201?{data:{id:"fixture"}}:{error:{code:"ACCESS_PERMISSION_DENIED"}}};
 }}} as BoPayrollPeriodEnv;
 assert.equal((await handleProductAdjustmentCommand(req(),env,path)).status,401);
 assert.equal(calls.length,0);
 const signed=()=>req(body,{headers:{cookie:"pino_staff_password_session=synthetic-only"}});
 keys=rights.slice(0,2);
 assert.equal((await handleProductAdjustmentCommand(signed(),env,path)).status,403);
 assert.deepEqual(calls.map(c=>c.path),["context"]);
 calls.length=0;keys=rights;
 assert.equal((await handleProductAdjustmentCommand(signed(),env,path)).status,403);
 assert.deepEqual(calls.map(c=>c.path),["context",corePath+"?centerId="+center]);
 assert.equal(calls[1]?.idempotencyKey,key);
 commandStatus=201;calls.length=0;
 const result=await handleBoPayrollPeriodRequest(signed(),env,path);
 assert.equal(result.status,201);
 assert.equal(result.headers.get("cache-control"),"no-store");
 assert.equal(result.headers.get("x-request-id"),"receipt");
 assert.deepEqual(await result.json(),{data:{id:"fixture"}});
});
