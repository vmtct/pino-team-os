import test from "node:test";
import assert from "node:assert/strict";
import {parseBannerHead} from "@/lib/pls-wish-ho-contract";
import {bannerEdit,addBannerItem,changeBannerItem,removeBannerItem,bannerEditCommand,publishedWishItems,wishLocalDate,wishUtcDate,type PublishedWishItem} from "./wish-banner-edit";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const time="2026-11-17T00:00:00.000Z";
const pool=[{itemId:id(4),revision:1,weight:2,featured:false}];
const draft={name:"QA",actor_user_id:id(2),created_at:time,banner_id:id(1),center_id:null,family_id:"default",starts_at:time,ends_at:"2026-12-17T00:00:00.000Z",pool_json:JSON.stringify(pool),version:1,base_pointer_version:0};
const raw={recordId:id(1),pointerVersion:0,active:false,published:null,latestDraft:draft,pendingDraft:draft,staleDraft:false},h=parseBannerHead(raw);
const item:PublishedWishItem={itemId:id(5),revision:8,name:"QA Item",status:"PUBLISHED",itemType:"WEARABLE"};
test("only exact published concrete revision may be added; no inferred rarity",()=>{
 const d=bannerEdit(h),next=addBannerItem(d,item.itemId,[item]);
 assert.deepEqual(next.value.pool[1],{itemId:id(5),revision:8,weight:1,featured:false});
 assert.throws(()=>addBannerItem(next,item.itemId,[item]));assert.throws(()=>addBannerItem(d,id(6),[item]));
 assert.throws(()=>publishedWishItems([item,item]));assert.throws(()=>publishedWishItems([{...item,status:"DRAFT"} as unknown as PublishedWishItem]));
 assert.throws(()=>publishedWishItems([{...item,itemType:"SET"} as unknown as PublishedWishItem]));
});
test("ledger supports fractional weight, featured and removal; no empty pool or stale CAS",()=>{
 const d=bannerEdit(h),next=changeBannerItem(addBannerItem(d,item.itemId,[item]),item.itemId,{weight:1.25,featured:true});
 const c=bannerEditCommand(removeBannerItem(next,id(4)),h);assert.deepEqual(c.body.pool,[{itemId:item.itemId,revision:8,weight:1.25,featured:true}]);assert.equal(c.body.expectedDraftVersion,1);
 assert.throws(()=>bannerEditCommand(removeBannerItem(d,id(4)),h));assert.throws(()=>changeBannerItem(d,id(4),{weight:0}));
 const later={...draft,version:2};assert.throws(()=>bannerEditCommand(d,parseBannerHead({...raw,latestDraft:later,pendingDraft:later})));
 assert.throws(()=>bannerEditCommand({...d,value:{...d.value,familyId:"other"}},h));
 assert.throws(()=>bannerEditCommand({...d,value:{...d.value,pool:[{...d.value.pool[0],weight:NaN}]}},h));
});

test("Vietnam local datetime is independent of host timezone and preserves milliseconds",()=>{
 assert.equal(wishLocalDate("2026-11-17T00:00:00.123Z"),"2026-11-17T07:00:00.123");
 assert.equal(wishUtcDate("2026-11-17T07:00"),"2026-11-17T00:00:00.000Z");
 assert.equal(wishUtcDate("2026-11-17T07:00:00.123"),"2026-11-17T00:00:00.123Z");
 assert.equal(wishUtcDate("2026-02-30T07:00"),"");
 assert.equal(wishUtcDate(""),"");
});
