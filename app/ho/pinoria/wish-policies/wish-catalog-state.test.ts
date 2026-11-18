import test from "node:test";
import assert from "node:assert/strict";
import {parseWishPolicies,parseWishBanners,selectWishRevision} from "./wish-catalog-state";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const time="2026-11-17T00:00:00.000Z";
const policy={name:"QA",actor_user_id:id(2),created_at:time,center_id:id(1),unit_cost:100,definition_json:JSON.stringify({rates:[.8,.18,.02],hard4:5,hard5:13,soft5:12,curve:[{position:12,rate:.08},{position:13,rate:1}],featuredGuarantee:false})};
const draft={...policy,version:1,base_pointer_version:0},head={recordId:id(1),pointerVersion:0,active:false,published:null,latestDraft:draft,pendingDraft:draft,staleDraft:false};
test("catalog rejects duplicate or malformed records without partial display",()=>{
 assert.deepEqual(parseWishPolicies([]),[]);assert.throws(()=>parseWishPolicies({policies:[head]}));assert.throws(()=>parseWishPolicies([head,head]));assert.throws(()=>parseWishPolicies([head,{...head,recordId:id(4)}]));assert.throws(()=>parseWishBanners([head]));
});
test("pending selection disappearing on publish falls back to real immutable revision",()=>{
 const first=parseWishPolicies([head])[0];assert.equal(selectWishRevision(first,"published"),"pending");
 const published={...policy,id:id(3),sequence:1},fresh=parseWishPolicies([{...head,pointerVersion:1,active:true,published,pendingDraft:null}])[0];
 assert.equal(selectWishRevision(fresh,"pending"),"published");
 const next={...draft,version:2,base_pointer_version:1},both=parseWishPolicies([{...head,pointerVersion:1,active:true,published,latestDraft:next,pendingDraft:next}])[0];
 assert.equal(selectWishRevision(both),"pending");assert.equal(selectWishRevision(both,"published"),"published");
});
