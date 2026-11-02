import test from "node:test";
import assert from "node:assert/strict";
import { HO_STAGING_HOSTNAME as host, decideHostBoundary } from "./host-boundary";
import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { handleBoOperationalReadRequest } from "./bo-read-handler";
import { mapHoCenters } from "./ho-centers";
const center = { id:"019d1000-0001-7000-8000-000000000001", key:"canonical", displayName:"Canonical Center", timeZone:"Asia/Ho_Chi_Minh", status:"active" };
function env(userId="founder", status=200): HoEnv { return { APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{async executeWithStaffPassword(request, token) { if(token!=="valid")return {status:401,requestId:"test",body:{}}; return {status:request.path==="context"?200:status,requestId:"test",body:{data:request.path==="context"?{userId,email:"server-verified@example.invalid",surface:"BO",entitled:true}:[center]}}; }} }; }
const headers = new Headers({host,cookie:"pino_staff_password_session=valid"});
test("HO exact host and method allowlist denies neighboring surfaces and business mutations",()=>{
 assert.deepEqual(decideHostBoundary(host,"/"),{action:"redirect",pathname:"/ho/centers"});
 for(const p of ["/ho","/ho/centers","/api/bo/context","/api/bo/centers","/staff-login","/api/staff-auth/status","/_next/static/chunk.js"]) assert.equal(decideHostBoundary(host,p).action,"next",p);
 for(const p of ["/bo","/dashboard","/api/bo/learners","/api/founder/users","/api/health","/api/bo/centers/x","/bo-authority-source/styles.css","/bo-skeleton/playground.html"])assert.equal(decideHostBoundary(host,p).action,"not_found",p);
 for(const method of ["POST","PATCH","PUT","DELETE","OPTIONS","HEAD"])assert.equal(decideHostBoundary(host,"/api/bo/centers",method).action,"not_found",method);
 for(const p of ["login","logout","change-password"])assert.equal(decideHostBoundary(host,"/api/staff-auth/"+p,"POST").action,"next");
 for(const h of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","bo.pinohouse.art","pino-team-os-staging.minhtri-van42.workers.dev","localhost","evil.example"])for(const p of ["/ho","/ho/centers"])assert.equal(decideHostBoundary(h,p).action,"not_found");
 assert.equal(decideHostBoundary(host.toUpperCase()+":443","/ho").action,"next");
});
test("HO uses a genuine current Core principal, fails closed for missing cohort, invalid session, non-Founder and production",async()=>{
 assert.equal((await authorizeHoShell(headers,env())).userId,"founder");
 await assert.rejects(()=>authorizeHoShell(new Headers({host}),env()),{status:401});
 await assert.rejects(()=>authorizeHoShell(new Headers({host,cookie:"pino_staff_password_session=forged"}),env()),{status:401});
 await assert.rejects(()=>authorizeHoShell(headers,env("staff")),{status:403});
 await assert.rejects(()=>authorizeHoShell(headers,{...env(),HO_PILOT_FOUNDER_USER_IDS:""}),{status:403});
 await assert.rejects(()=>authorizeHoShell(headers,{...env(),APP_ENV:"production"}),{status:404});
 await assert.rejects(()=>authorizeHoShell(new Headers({host:"bo.staging.pinohouse.art"}),env()),{status:404});
});
test("HO Center facade preserves Core permission denial, restricts paths and read methods",async()=>{
 const req=(method="GET")=>new Request("https://"+host+"/api/bo/centers",{method,headers});
 assert.equal((await handleBoOperationalReadRequest(req(),env(),"centers")).status,200);
 assert.equal((await handleBoOperationalReadRequest(req(),env("staff"),"centers")).status,403);
 assert.equal((await handleBoOperationalReadRequest(req(),env("founder",403),"centers")).status,403);
 assert.equal((await handleBoOperationalReadRequest(req(),env(),"learners")).status,404);
 assert.equal((await handleBoOperationalReadRequest(req("POST"),env(),"centers")).status,405);
 const body=await (await handleBoOperationalReadRequest(req(),env(),"centers")).json();
 assert.deepEqual(body.data,[center]);
});
test("Center mapping preserves real values and rejects absent, duplicate and invalid records",()=>{
 assert.deepEqual(mapHoCenters([]),[]); assert.deepEqual(mapHoCenters([center]),[{id:center.id,name:center.displayName,centerKey:center.key,timeZone:center.timeZone,status:center.status}]);
 for(const input of [null,{},[null],[{}],[{...center,id:"fake"}],[center,center],[{...center,timeZone:"unknown"}],[{...center,status:null}]])assert.throws(()=>mapHoCenters(input));
});
