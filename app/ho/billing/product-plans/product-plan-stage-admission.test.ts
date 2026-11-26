import test from "node:test";
import assert from "node:assert/strict";
import {productPlanStageQuery,productPlanActorAllowed} from "./product-plan-stage-admission";
const id="01900000-0000-7000-8000-000000000001",host="ho.staging.pinohouse.art";
test("native Product Plan canonical staging query rejects retired preview, duplicate, mock and foreign host",()=>{
 assert.deepEqual(productPlanStageQuery("staging",host,{}),{record:null,tab:"overview"});
 assert.deepEqual(productPlanStageQuery("staging",host,{record:id,tab:"subscriptions"}),{record:id,tab:"subscriptions"});
 for(const q of [{m1Preview:"1"},{record:"PRODUCT-PLAN-MOCK-001"},{record:[id,id]},{tab:"history"},{record:id,tab:"unknown"},{centerId:id}])assert.equal(productPlanStageQuery("staging",host,q),null);
 assert.equal(productPlanStageQuery("production",host,{}),null);
 assert.equal(productPlanStageQuery("staging","bo.staging.pinohouse.art",{}),null);
});
test("server page requires actual admitted HO actor and read grant, does not imply write",()=>{
 const actor={userId:id,entitled:true,permissionKeys:["team.bo.access","billing.view"]};
 assert.equal(productPlanActorAllowed(actor),true);
 for(const bad of [{...actor,userId:"mock"},{...actor,entitled:false},{...actor,permissionKeys:["billing.view"]},{...actor,permissionKeys:["team.bo.access","billing.manage"]}])assert.equal(productPlanActorAllowed(bad),false);
});
