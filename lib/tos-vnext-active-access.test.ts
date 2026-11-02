import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {canOpenVNextApp} from "./tos-vnext-active-access";
import {SIX_TOS_APPS} from "../app/components/tos-vnext/identity";
const ready={authenticated:true,centerReady:true,desktop:true};
test("PAP-1127 all six TOS apps open without ShiftAssignment, role or schedule",()=>{
 for(const app of SIX_TOS_APPS) assert.equal(canOpenVNextApp(app.id,ready),true,app.id);
});
test("PAP-1127 authentication and Center context required for all apps",()=>{
 for(const app of SIX_TOS_APPS) for(const k of ["authenticated","centerReady"] as const)
  assert.equal(canOpenVNextApp(app.id,{...ready,[k]:false}),false,app.id+":"+k);
});
test("PAP-1127 only Trạm TOS requires desktop, other five are shift-independent",()=>{
 assert.equal(canOpenVNextApp("station",{...ready,desktop:false}),false);
 for(const app of SIX_TOS_APPS.filter(app=>app.id!=="station"))
  assert.equal(canOpenVNextApp(app.id,{...ready,desktop:false}),true,app.id);
});
test("PAP-1127 unknown app identity is denied",()=>assert.equal(canOpenVNextApp("unknown" as never,ready),false));
test("PAP-1127 VNext integration has no schedule launch gate or forced Shift Lead tile lock",()=>{
 const client=readFileSync(resolve(process.cwd(),"app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx"),"utf8");
 const home=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/TosVNextHome.tsx"),"utf8");
 assert.doesNotMatch(client,/scheduleReady:!!data\.shift|!ctx\|\|!centerId\|\|!data\.shift|resolveTosAppAccess/);
 assert.doesNotMatch(home,/founderMode\|\|app\.id!=="shift-lead"/);
 assert.match(client,/canOpenVNextApp/);
});
