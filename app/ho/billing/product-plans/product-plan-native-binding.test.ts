import test from "node:test";
import assert from "node:assert/strict";
import {createPlanContext,nativePlanSchema,nativePlanUrl,parseNativePlanQuery} from "./product-plan-native-binding";
import {createProductPlanClient} from "./product-plan-native-contract";
import {loadHistory,composeTabs,type AuthorizationContext,type ModuleSchema} from "@/lib/workspace-schema";
const id="01900000-0000-7000-8000-000000000001",event="01900000-0000-7000-8000-000000000002",at="2026-11-26T00:00:00.000Z";
const context:AuthorizationContext={surface:"HO",authorize:key=>key==="billing.view"||key==="billing.manage"};
const signal=new AbortController().signal;
test("strict canonical real record and tab links, no mock or preview switch",()=>{
 assert.deepEqual(parseNativePlanQuery(new URLSearchParams("record="+id+"&tab=history")),{record:id,tab:"history"});
 assert.equal(nativePlanUrl(id,"subscriptions"),"/ho/billing/product-plans?record="+id+"&tab=subscriptions");
 for(const q of ["record=PRODUCT-PLAN-MOCK-001","m1Preview=1","tab=history","record="+id+"&record="+id,"record="+id+"&tab=unknown"])assert.equal(parseNativePlanQuery(new URLSearchParams(q)),null);
});
test("native bound schema preserves approved fields and tabs, redacted history through shared validator",async()=>{
 const client=createProductPlanClient(async()=>({status:200,data:{items:[{id:event,occurredAt:at,actorId:null,action:"billing.product_plan_updated",previous:{listPriceMinor:100},next:{listPriceMinor:200}}],nextAfter:null}}));
 const schema=nativePlanSchema;
 const bound=createPlanContext(client,context.authorize);
 assert.deepEqual(composeTabs(schema).map(t=>t.id),["overview","subscriptions","history"]);
 assert.equal(schema.table.inlineEdit.fields.length,6);
 const result=await loadHistory(schema as unknown as ModuleSchema,{type:"product_plan",id},bound,signal);
 assert.equal(result.status,"authorized");
 if(result.status==="authorized")assert.deepEqual(result.events[0].changes,[{field:"price",before:100,after:200}]);
 await assert.rejects(schema.data.detail(id,{surface:"HO",authorize:()=>true},signal));
});
