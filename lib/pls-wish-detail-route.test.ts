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
