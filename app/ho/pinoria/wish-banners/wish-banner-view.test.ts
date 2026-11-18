import test from "node:test";
import assert from "node:assert/strict";
import {parseBannerHead} from "@/lib/pls-wish-ho-contract";
import {bannerView,wishBannerModule,wishBannerItemModule} from "./wish-banner-view";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const time="2026-11-17T00:00:00.000Z",end="2026-12-17T00:00:00.000Z";
const pool=[{itemId:id(4),revision:1,weight:1,featured:false},{itemId:id(5),revision:2,weight:3,featured:true}];
const value={name:"QA Banner",actor_user_id:id(2),created_at:time,banner_id:id(1),center_id:null,family_id:"default",starts_at:time,ends_at:end,pool_json:JSON.stringify(pool)};
const draft={...value,version:1,base_pointer_version:0};
const base={recordId:id(1),pointerVersion:0,active:false,published:null,latestDraft:draft,pendingDraft:draft,staleDraft:false};
test("global banner overview excludes raw pool and policy linkage; draft rarity remains unknown",()=>{
 const v=bannerView(parseBannerHead(base),"pending","Not a global label");
 assert.equal(v.row.center,"Global");assert.equal(v.row.status,"DRAFT");assert.equal(v.row.createdAt,null);
 assert.equal(v.itemRows[0]?.name,"—");assert.equal(v.itemRows[0]?.rarity,null);assert.deepEqual(v.itemRows.map(i=>i.relativeShare),[25,75]);
 for(const key of ["pool","featured","policyId","policyRevisionId"])assert.equal(Object.hasOwn(v.row,key),false);
 assert.ok(wishBannerModule.fields.every(f=>f.readonly));assert.ok(wishBannerItemModule.fields.every(f=>f.readonly));
});
test("published immutable rarity and verified record audit, not draft or actor guess",()=>{
 const published={...value,center_id:id(3),id:id(6),sequence:1,pool_json:JSON.stringify(pool.map((i,n)=>({...i,rarity:n===0?3:5})))};
 const audit={createdAt:time,updatedAt:end,createdByUserId:id(2),updatedByUserId:id(7),createdByUser:null,updatedByUser:"QA Verified"};
 const actual=parseBannerHead({...base,pointerVersion:1,active:true,published,pendingDraft:null,...audit});
 const v=bannerView(actual,"published",null);
 assert.equal(v.row.center,null);assert.equal(v.row.createdByUser,null);assert.equal(v.row.updatedByUser,"QA Verified");
 assert.deepEqual(v.itemRows.map(i=>i.rarity),[3,5]);assert.equal(v.row.status,"PUBLISHED");
 assert.equal(bannerView({...actual,active:false},"published","QA Center").row.status,"RETIRED");
 assert.throws(()=>bannerView(actual,"pending",null));
});
test("relative weights remain finite for extreme valid weight values",()=>{
 const d={...draft,pool_json:JSON.stringify(pool.map(i=>({...i,weight:Number.MAX_VALUE})))};
 const v=bannerView(parseBannerHead({...base,latestDraft:d,pendingDraft:d}),"pending",null);
 assert.deepEqual(v.itemRows.map(i=>i.relativeShare),[50,50]);
});
