// PAP-2183 / PAP-2372 — native schema and opt-in shared direct property contract.
import test from "node:test";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {createElement as h} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {TddRenderer} from "../app/components/workspace-renderer/Renderer";
import {composeTabs,allowsField,validateQuery,type AuthorizationContext,type MutationAdapter} from "./workspace-schema";
import {planQuery,projectPlan,PLAN_READ,PLAN_EDIT,type PlanFields} from "../app/ho/billing/product-plans/schema";
import {nativePlanRegistry as planRegistry,nativePlanSchema as planSchema,parseNativePlanQuery} from "../app/ho/billing/product-plans/product-plan-native-binding";
// Isolated unit-test projection only; no runtime seed or provider.
const seed={id:"0199f000-0007-7000-8000-000000000007",name:"Unit test plan",cadence:1,termWeeks:12,price:1990000,currency:"VND" as const,badge:"ENTRY" as const,enabled:true,version:1,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
const record=projectPlan(seed);
const context:AuthorizationContext={surface:"HO",authorize:key=>[PLAN_READ,PLAN_EDIT].includes(key)};
const readonly:AuthorizationContext={surface:"HO",authorize:key=>key===PLAN_READ};
const adapter:MutationAdapter<PlanFields>={update:async()=>{throw Error("No writes during render");}};
const base={registry:planRegistry,schema:planSchema,context,record};
test("Product Plan field manifest, audit defaults, immutable identity, reserved history",()=>{
 validateQuery(planSchema,planQuery,context);
 assert.deepEqual(composeTabs(planSchema).map(t=>t.id),["overview","subscriptions","history"]);
 for(const key of ["createdAt","createdBy","updatedAt","updatedBy"])assert.ok(planQuery.visible.includes(key as typeof planQuery.visible[number]));
 assert.deepEqual(planSchema.fields.filter(f=>allowsField(planSchema,context,f.key,"inlineEdit")).map(f=>f.key),["name","cadence","termWeeks","price","badge","enabled"]);
 assert.equal(planSchema.fields.some(f=>allowsField(planSchema,readonly,f.key,"inlineEdit")),false);
 assert.deepEqual(planSchema.drawer.actions,[]);
 assert.equal(record.createdAt,null);assert.equal(record.createdBy,"—");assert.equal(record.updatedBy,"—");assert.equal(seed.createdBy,null);assert.equal(seed.updatedBy,null);
});
test("native drawer and detail opt in to direct fields only; default popover preserved",()=>{
 const writes={adapter,version:"1",onSaved:()=>{},directFields:["name","cadence","termWeeks","price","badge","enabled"]};
 const drawer=(ctx=context,direct=true)=>renderToStaticMarkup(h(TddRenderer<PlanFields>,{view:{kind:"drawer",props:{...base,context:ctx,writes:direct?writes:{adapter,version:"1",onSaved:()=>{}},onClose:()=>{},onDetail:()=>{}}}}));
 const detail=renderToStaticMarkup(h(TddRenderer<PlanFields>,{view:{kind:"detail",props:{...base,writes,onBack:()=>{},subject:{type:"product_plan",id:record.id}}}}));
 for(const html of [drawer(),detail]){
   for(const key of ["name","cadence","termWeeks","price","badge","enabled"])assert.match(html,new RegExp('data-tdd-direct-field="'+key+'"'));
   assert.equal((html.match(/data-pds-appearance="underline"/g)??[]).length,6);assert.equal((html.match(/data-pino-ds="bo"/g)??[]).length,6);
   assert.doesNotMatch(html,/data-tdd-direct-field="(?:planId|currency|version)"/);
 }
 assert.doesNotMatch(drawer(readonly),/data-pds-appearance="underline"/);
 assert.doesNotMatch(drawer(context,false),/data-tdd-direct-field=/);
 assert.match(drawer(context,false),/data-detail-edit="price"/);
 assert.match(detail,/Lịch sử/);
});

test("canonical native route admits only real record navigation",()=>{
 const parse=(s:string)=>parseNativePlanQuery(new URLSearchParams(s));
 assert.deepEqual(parse(""),{record:null,tab:"overview"});
 assert.deepEqual(parse("record="+seed.id+"&tab=history"),{record:seed.id,tab:"history"});
 for(const q of ["record=PRODUCT-PLAN-MOCK-001","m1Preview=1","m1Preview=0","record="+seed.id+"&record="+seed.id,"tab=history","record="+seed.id+"&tab=unknown","next=/bo"])assert.equal(parse(q),null,q);
});
test("PAP-2183 Staging native component imports canonical BO/HO design tokens",()=>{
 const content=readFileSync("app/ho/billing/product-plans/ProductPlanNativeContent.tsx","utf8");
 assert.match(content,/import "@pino\/design-system\/bo-tokens\.css";/);
});