import test from "node:test";
import assert from "node:assert/strict";
import {canOpenVNextApp} from "./tos-vnext-active-access";
import {SIX_TOS_APPS} from "../app/components/tos-vnext/identity";
const ready={authenticated:true,centerReady:true,scheduleReady:true,desktop:true,
 access:{reception:true,classroom:true,"shift-lead":true}};
test("PAP-940 fail closed on missing center, schedule, or session for all six apps",()=>{
 for(const app of SIX_TOS_APPS){
  for(const k of ["authenticated","centerReady","scheduleReady"] as const){
   assert.equal(canOpenVNextApp(app.id,{...ready,[k]:false}),false,`${app.id}: ${k}`);
  }
 }
});
test("PAP-940 enter and mid-session revocation share the same decision",()=>{
 for(const app of ["reception","classroom","shift-lead"] as const){
  assert.equal(canOpenVNextApp(app,ready),true);
  assert.equal(canOpenVNextApp(app,{...ready,access:{...ready.access,[app]:false}}),false);
 }
 assert.equal(canOpenVNextApp("station",{...ready,desktop:false}),false);
 assert.equal(canOpenVNextApp("shift",{...ready,access:null}),true);
 assert.equal(canOpenVNextApp("training",{...ready,access:null}),true);
});
