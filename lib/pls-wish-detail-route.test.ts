import test from "node:test";
import assert from "node:assert/strict";
import {readWishDetailRoute,wishDetailUrl} from "./pls-wish-detail-route";
const record="019a0000-0000-7000-8000-000000000001",centerId="019a0000-0000-7000-8000-000000000002";
test("Wish Detail identity and tab round trip without losing independent URL state",()=>{
 const href="https://bo.staging.pinohouse.art/bo/pinoria-wish?other=1";
 const route={record,tab:"items" as const,centerId};
 const dest=wishDetailUrl(href,"event",route);const url=new URL(dest,href);
 assert.deepEqual(readWishDetailRoute(url.search,"event",centerId),route);assert.equal(url.searchParams.get("other"),"1");
 assert.equal(wishDetailUrl(url.href,"event",null),"/bo/pinoria-wish?other=1");
});
test("HO pins published identity or exact draft version and rejects cross-surface revision URLs",()=>{
 const href="https://ho.staging.pinohouse.art/ho/pinoria/wish-policies";
 for(const version of [{selection:"published" as const,revision:centerId},{selection:"pending" as const,revision:"7"}]){const route={record,tab:"history" as const,version};const url=new URL(wishDetailUrl(href,"policy",route),href);assert.deepEqual(readWishDetailRoute(url.search,"policy"),route);}
 for(const params of ["wishSelection=pending&wishRevision=0","wishSelection=pending&wishRevision=9007199254740992","wishSelection=published&wishRevision=7","wishSelection=pending","wishRevision=7","wishSelection=pending&wishSelection=published&wishRevision=7"])assert.throws(()=>readWishDetailRoute("?record="+record+"&"+params,"policy"));
 assert.throws(()=>readWishDetailRoute("?record="+record+"&wishCenter="+centerId+"&wishSelection=pending&wishRevision=7","event",centerId));
});
test("Detail denies duplicate, malformed, foreign Center, policy Item tab, and partial URL",()=>{
 for(const q of ["?record=wrong","?tab=history","?record="+record+"&record="+record,"?record="+record+"&tab=missing","?record="+record+"&tab=items","?record="+record+"&wishCenter="+centerId])assert.throws(()=>readWishDetailRoute(q,"policy"));
 const q="?record="+record+"&tab=history&wishCenter="+centerId;
 assert.throws(()=>readWishDetailRoute(q,"event",record));assert.throws(()=>readWishDetailRoute("?record="+record,"event",centerId));
 assert.equal(readWishDetailRoute("?unrelated=1","banner"),null);
});

test("reward links pin exact event, Center, ordinal, Item identity and immutable revision; close preserves parent tab",()=>{
 const href="https://bo.staging.pinohouse.art/bo/pinoria-wish-events?other=1";const itemId="019a0000-0000-7000-8000-000000000003";
 const parent={record,tab:"items" as const,centerId},route={...parent,reward:{ordinal:10,itemId,revision:7}};
 const url=new URL(wishDetailUrl(href,"event",route),href);assert.deepEqual(readWishDetailRoute(url.search,"event",centerId),route);
 assert.deepEqual(readWishDetailRoute(new URL(wishDetailUrl(url.href,"event",parent),href).search,"event",centerId),parent);
 for(const [key,value] of [["rewardOrdinal","11"],["rewardOrdinal","01"],["rewardRevision","9007199254740992"],["rewardItem","bad"],["tab","history"]]){const bad=new URL(url);bad.searchParams.set(key,value);assert.throws(()=>readWishDetailRoute(bad.search,"event",centerId));}
 for(const key of ["rewardOrdinal","rewardItem","rewardRevision"]){const bad=new URL(url);bad.searchParams.delete(key);assert.throws(()=>readWishDetailRoute(bad.search,"event",centerId));const duplicate=new URL(url);duplicate.searchParams.append(key,url.searchParams.get(key)!);assert.throws(()=>readWishDetailRoute(duplicate.search,"event",centerId));}
 assert.throws(()=>readWishDetailRoute(url.search,"event",record));assert.throws(()=>readWishDetailRoute("?rewardOrdinal=1","policy"));
});
