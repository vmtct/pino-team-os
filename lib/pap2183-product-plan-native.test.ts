// PAP-2183 / PAP-2372 — native schema and opt-in shared direct property contract.
import test from "node:test";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {createElement as h} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {TddRenderer} from "../app/components/workspace-renderer/Renderer";
import {composeTabs,allowsField,validateQuery,type AuthorizationContext,type MutationAdapter} from "./workspace-schema";
import {planRegistry,planSchema,planQuery,projectPlan,PLAN_READ,PLAN_EDIT,type PlanFields} from "../app/ho/billing/product-plans/schema";
import {productPlanM1,parseProductPlanReviewQuery,isProductPlanLocalOrigin} from "../app/ho/billing/product-plans/product-plan-m1-preview";
const record=projectPlan(productPlanM1.seed);
const context:AuthorizationContext={surface:"HO",authorize:key=>[PLAN_READ,PLAN_EDIT].includes(key)};
const readonly:AuthorizationContext={surface:"HO",authorize:key=>key===PLAN_READ};
const adapter:MutationAdapter<PlanFields>={update:async()=>{throw Error("No writes during render");}};
const base={registry:planRegistry,schema:planSchema,context,record};
test("Product Plan field manifest, audit defaults, immutable identity, reserved history",()=>{
 validateQuery(planSchema,planQuery,context);
 assert.deepEqual(composeTabs(planSchema).map(t=>t.id),["overview","subscriptions","history"]);
 for(const key of ["createdAt","createdBy","updatedAt","updatedBy"])assert.ok(planQuery.visible.includes(key as typeof planQuery.visible[number]));
 assert.deepEqual(planSchema.fields.filter(f=>allowsField(planSchema,context,f.key,"inlineEdit")).map(f=>f.key),["name","price","badge","enabled"]);
 assert.equal(planSchema.fields.some(f=>allowsField(planSchema,readonly,f.key,"inlineEdit")),false);
 assert.deepEqual(planSchema.drawer.actions,[]);
 assert.equal(record.createdAt,null);assert.equal(record.createdBy,"—");assert.equal(record.updatedBy,"—");assert.equal(productPlanM1.seed.createdBy,null);assert.equal(productPlanM1.seed.updatedBy,null);
});
test("native drawer and detail opt in to direct fields only; default popover preserved",()=>{
 const writes={adapter,version:"1",onSaved:()=>{},directFields:["name","price","badge","enabled"]};
 const drawer=(ctx=context,direct=true)=>renderToStaticMarkup(h(TddRenderer<PlanFields>,{view:{kind:"drawer",props:{...base,context:ctx,writes:direct?writes:{adapter,version:"1",onSaved:()=>{}},onClose:()=>{},onDetail:()=>{}}}}));
 const detail=renderToStaticMarkup(h(TddRenderer<PlanFields>,{view:{kind:"detail",props:{...base,writes,onBack:()=>{},subject:{type:"product_plan",id:record.id}}}}));
 for(const html of [drawer(),detail]){
   for(const key of ["name","price","badge","enabled"])assert.match(html,new RegExp('data-tdd-direct-field="'+key+'"'));
   assert.equal((html.match(/data-pds-appearance="underline"/g)??[]).length,4);assert.equal((html.match(/data-pino-ds="bo"/g)??[]).length,4);
   assert.doesNotMatch(html,/data-tdd-direct-field="cadence"/);
 }
 assert.doesNotMatch(drawer(readonly),/data-pds-appearance="underline"/);
 assert.doesNotMatch(drawer(context,false),/data-tdd-direct-field=/);
 assert.match(drawer(context,false),/data-detail-edit="price"/);
 assert.match(detail,/Lịch sử/);
});

test("canonical review path validates exact synthetic state and explicit local origins",()=>{
 const parse=(s:string,legacy=false)=>parseProductPlanReviewQuery(new URLSearchParams(s),legacy);
 assert.deepEqual(parse(""),{record:undefined,legacy:false});
 assert.deepEqual(parse("record=PRODUCT-PLAN-MOCK-001"),{record:"PRODUCT-PLAN-MOCK-001",legacy:false});
 assert.equal(parse("m1Preview=1"),null);
 assert.deepEqual(parse("m1Preview=1&record=PRODUCT-PLAN-MOCK-001",true),{record:"PRODUCT-PLAN-MOCK-001",legacy:true});
 for(const q of ["record=PRODUCT-PLAN-MOCK-002","record=real-id","record=","record=PRODUCT-PLAN-MOCK-001&record=PRODUCT-PLAN-MOCK-001","m1Preview=0","m1Preview=1&m1Preview=1","tab=unknown","next=/bo"])assert.equal(parse(q,true),null);
 for(const origin of ["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800"])assert.equal(isProductPlanLocalOrigin(origin),true);
 for(const origin of ["http://192.168.1.6:8800","http://localhost:8800","https://ho.staging.pinohouse.art","http://desktop-isrdren.evil:8800","http://desktop-isrdren:8801"])assert.equal(isProductPlanLocalOrigin(origin),false);
});
test("PAP-2183 Staging native component imports canonical BO/HO design tokens",()=>{
 const content=readFileSync("app/ho/billing/product-plans/ProductPlanM1Content.tsx","utf8");
 assert.match(content,/import "@pino\/design-system\/bo-tokens\.css";/);
});