import test from "node:test";
import assert from "node:assert/strict";
import {authorizeTosV4Staging,TosV4GateError,TOS_V4_STAGING_HOSTS,type TosV4GateEnv} from "./tos-v4-staging-gate";
import {decideHostBoundary,requiresTosStaffSession} from "./host-boundary";
const host=TOS_V4_STAGING_HOSTS[0],cookie="pino_staff_password_session=opaque-test-token";
const context={userId:"u",staffMemberId:"s",centers:[]};
function env(status=200,data:unknown=context,code="DENIED"):TosV4GateEnv{return {APP_ENV:"staging",PINO_WORKFORCE_CORE:{executeWithStaffPassword:async(req,token)=>{assert.deepEqual(req,{method:"GET",path:"/context"});assert.equal(token,"opaque-test-token");return {status,body:{data,error:{code}},requestId:"test"}}}}}
test("PAP-938 V4 staging requires exact staging host plus APP_ENV before any Core access",async()=>{
 for(const h of ["tos.pinohouse.art","bo.staging.pinohouse.art","ho.staging.pinohouse.art","localhost","pino-team-os.minhtri-van42.workers.dev",host+".attacker.example"]){await assert.rejects(authorizeTosV4Staging(new Headers({host:h,cookie}),env()),e=>e instanceof TosV4GateError&&e.status===404);assert.equal(decideHostBoundary(h,"/tos-v4").action,"not_found")}
 for(const APP_ENV of [undefined,"production","development"]){await assert.rejects(authorizeTosV4Staging(new Headers({host,cookie}),{...env(),APP_ENV}),e=>e instanceof TosV4GateError&&e.status===404)}
});
test("PAP-938 V4 staging uses canonical staff session/context, never cookie presence alone",async()=>{
 await assert.rejects(authorizeTosV4Staging(new Headers({host}),env()),e=>e instanceof Error&&"status" in e&&e.status===401);
 for(const status of [401,403,503])await assert.rejects(authorizeTosV4Staging(new Headers({host,cookie}),env(status)),e=>e instanceof TosV4GateError&&e.status===status);
 for(const data of [null,{}, {...context,staffMemberId:null},{...context,centers:null}])await assert.rejects(authorizeTosV4Staging(new Headers({host,cookie}),env(200,data)),e=>e instanceof TosV4GateError&&e.status===403);
 for(const h of TOS_V4_STAGING_HOSTS){assert.deepEqual(await authorizeTosV4Staging(new Headers({host:h,cookie}),env()),context);assert.equal(requiresTosStaffSession(h,"/tos-v4"),true)}
});
test("PAP-938 original prototype fence, BO and HO host separation remain intact",()=>{
 for(const h of [...TOS_V4_STAGING_HOSTS,"tos.pinohouse.art"]){assert.equal(decideHostBoundary(h,"/prototype/tos-vnext-integration").action,"not_found")}
 assert.equal(decideHostBoundary(host,"/bo").action,"not_found");assert.equal(decideHostBoundary(host,"/ho").action,"not_found");
});

test("PAP-938 only Core-verified Founder may enter TOS without linked Staff",async()=>{
 const founder={userId:"founder",staffMemberId:null,founderMode:true,centers:[{id:"center",displayName:"PINO"}]};
 assert.deepEqual(await authorizeTosV4Staging(new Headers({host,cookie}),env(200,founder)),founder);
 for(const data of [
  {...founder,founderMode:false},
  {...founder,founderMode:undefined},
  {...founder,staffMemberId:"",founderMode:true},
  {...founder,centers:null},
 ]){
  await assert.rejects(authorizeTosV4Staging(new Headers({host,cookie}),env(200,data)),(e:unknown)=>e instanceof TosV4GateError&&e.status===403);
 }
});
