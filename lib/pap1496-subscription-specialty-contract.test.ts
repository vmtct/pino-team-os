/** PAP-1496 / PAP-1491 SPEC-UNLOCK — strict BO facade + canonical Subscription UI contract. */
import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {isBoSubscriptionSpecialtyPath,validateSubscriptionSpecialtyScope,
 handleBoSubscriptionSpecialtyRequest} from "./bo-subscription-specialty-facade";
import {readSubscriptionDetailRoute,subscriptionDetailUrl} from "./bo-subscription-detail-url";

const sub="019a0f22-1111-7111-8111-000000000005";
const grant="019a0f22-1111-7111-8111-000000000008";
const center="019a0f22-1111-7111-8111-000000000002";
const base="https://bo.pinohouse.art/api/bo/";
const list=`subscriptions/${sub}/specialties`;
const create=`subscriptions/${sub}/specialty-grants`;
const completion=`subscriptions/${sub}/specialty-grants/${grant}/completion`;
void test("PAP-1496 BO facade admits only exact Subscription Specialty routes",()=>{
 assert.equal(isBoSubscriptionSpecialtyPath(list),true);
 assert.equal(isBoSubscriptionSpecialtyPath(create),true);
 assert.equal(isBoSubscriptionSpecialtyPath(completion),true);
 for(const route of ["learning/students/"+sub+"/specialties","specialty/purchases",`subscriptions/${sub}/specialty-grants/${grant}`,
  `subscriptions/${sub}/specialty-grants/${grant}/revoke`,`subscriptions/${sub}/specialty-grants/${grant}/completion/history`])
  assert.equal(isBoSubscriptionSpecialtyPath(route),false,route);
});
void test("PAP-1496 Center selection must be exactly one canonical UUID, never inferred",()=>{
 const request=(query:string)=>new Request(base+list+query);
 assert.deepEqual(validateSubscriptionSpecialtyScope(list,request(`?centerId=${center}`)),{centerId:center,isRead:true});
 assert.equal(validateSubscriptionSpecialtyScope(list,request("")),null);
 assert.equal(validateSubscriptionSpecialtyScope(list,request("?centerId=all")),null);
 assert.equal(validateSubscriptionSpecialtyScope(list,request(`?centerId=${center}&centerId=${center}`)),null);
 assert.equal(validateSubscriptionSpecialtyScope(list,request(`?centerId=${center}&role=founder`)),null);
});
void test("PAP-1496 bad methods and invalid Center fail before network or auth",async()=>{
 const env={} as Parameters<typeof handleBoSubscriptionSpecialtyRequest>[1];
 for(const [path,method] of [[list,"POST"],[create,"PATCH"],[completion,"POST"]] as const){
  const request=new Request(base+path+`?centerId=${center}`,{method});
  const result=await handleBoSubscriptionSpecialtyRequest(request,env,path);
  assert.equal(result.status,405);
 }
 const malformed=await handleBoSubscriptionSpecialtyRequest(new Request(base+list),env,list);
 assert.equal(malformed.status,400);
 const spoof=new Request(base+list+`?centerId=${center}&permission=all`);
 assert.equal((await handleBoSubscriptionSpecialtyRequest(spoof,env,list)).status,400);
 const ho=new Request("https://ho.staging.pinohouse.art/api/bo/"+list+`?centerId=${center}`);
 assert.equal((await handleBoSubscriptionSpecialtyRequest(ho,env,list)).status,404);
});
void test("PAP-1496 Subscription detail URL addresses Chuyên đề and preserves unrelated query",()=>{
 const url=subscriptionDetailUrl("https://bo.pinohouse.art/bo?module=subscriptions&foo=bar",sub,"Chuyên đề");
 assert.match(url,/record=019a0f22/);
 assert.match(url,/tab=specialty/);
 assert.match(url,/foo=bar/);
 assert.deepEqual(readSubscriptionDetailRoute("?record="+sub+"&tab=specialty"),{id:sub,invalid:false,tab:"Chuyên đề"});
 assert.equal(readSubscriptionDetailRoute("?record=wrong&tab=specialty").invalid,true);
});
void test("PAP-1496 UI reuses shared Drawer/Detail and never invokes legacy Student purchase",()=>{
 const root=new URL("../app/bo/",import.meta.url);
 const component=readFileSync(new URL("subscriptions/BoSubscriptionSpecialtyTab.tsx",root),"utf8");
 const detail=readFileSync(new URL("components/registration/BoFullDetail.tsx",root),"utf8");
 const facade=readFileSync(new URL("api/bo/[...path]/route.ts",new URL("../app/",import.meta.url)),"utf8");
 assert.match(component,/BoQuickView/);
 assert.match(component,/DetailFrame/);
 assert.match(component,/subscriptionSpecialtyClient[.]create/);
 assert.match(component,/subscriptionSpecialtyClient[.]complete/);
 assert.doesNotMatch(component,/createSpecialtyPurchase|completeSpecialtyAllocation|student-specialty-grants/);
 assert.match(detail,/moduleKey === "subscriptions"[\s\S]*"Chuyên đề"/);
 assert.match(facade,/isBoSubscriptionSpecialtyPath/);
});
