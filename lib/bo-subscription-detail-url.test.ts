import {test} from "node:test";
import assert from "node:assert/strict";
import {readSubscriptionDetailRoute,subscriptionDetailUrl} from "./bo-subscription-detail-url";
const id="01a1818d-3ef6-7d37-a9af-22de40ff4163";
test("PAP-1102 URL preserves BO search/filter state while opening and closing an immutable record",()=>{
 const old="https://bo.staging.pinohouse.art/bo?module=subscriptions&view=my-view&page=3";
 const url=subscriptionDetailUrl(old,id);
 assert.equal(url,"/bo?module=subscriptions&view=my-view&page=3&record="+id);
 assert.deepEqual(readSubscriptionDetailRoute(new URL(url,"https://example.test").search),{id,invalid:false,tab:"Detail"});
 assert.equal(subscriptionDetailUrl("https://example.test"+url,null),"/bo?module=subscriptions&view=my-view&page=3");
});
test("PAP-1102 tab restores on refresh/back, unknown tab cannot forge a business tab",()=>{
 const url=subscriptionDetailUrl("https://example.test/bo?module=subscriptions",id,"Lịch Sử");
 assert.equal(url,"/bo?module=subscriptions&record="+id+"&tab=history");
 assert.equal(readSubscriptionDetailRoute(new URL(url,"https://example.test").search).tab,"Lịch Sử");
 assert.equal(readSubscriptionDetailRoute("?record="+id+"&tab=malicious").tab,"Detail");
});
test("PAP-1102 malformed, empty, non-ID records fail closed without URL/PII injection",()=>{
 assert.deepEqual(readSubscriptionDetailRoute("?record=bad%2Fname%40email.test"),{id:null,invalid:true,tab:"Detail"});
 assert.deepEqual(readSubscriptionDetailRoute("?module=subscriptions"),{id:null,invalid:false,tab:"Detail"});
 assert.throws(()=>subscriptionDetailUrl("https://example.test/bo", "not-an-id"));
});
