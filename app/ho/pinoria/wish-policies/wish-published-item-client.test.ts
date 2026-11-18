import test from "node:test";
import assert from "node:assert/strict";
import {allocateWishBannerId,parsePublishedWishChoices,loadPublishedWishPreview,loadPublishedWishRecord} from "./wish-published-item-client";
const itemId="0198d050-56c1-7ac5-b9ab-b0e45d912345";
const item={itemId,revision:3,name:"QA Item",status:"PUBLISHED",itemType:"ACCESSORY",rarity:5};
test("only exact rated published Item metadata; no raw asset",()=>{
 assert.equal(parsePublishedWishChoices([item])[0]?.revision,3);
 for(const v of [{...item,rarity:null},{...item,revision:0},{...item,status:"DRAFT"},{...item,itemType:"SET"},{...item,asset:{}}])assert.throws(()=>parsePublishedWishChoices([v]));
 assert.throws(()=>parsePublishedWishChoices([item,item]));
});
test("client allocates canonical unique v7 ids with exact 48-bit timestamp",()=>{const before=Date.now(),ids=Array.from({length:100},allocateWishBannerId),after=Date.now();assert.equal(new Set(ids).size,100);for(const id of ids){assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);const time=parseInt(id.replaceAll("-","").slice(0,12),16);assert.ok(time>=before&&time<=after);}});
test("preview request pins item and revision; never silently uses a different snapshot",async()=>{
 const target={itemId,revision:3},sig=new AbortController().signal;
 const payload={...item,mimeType:"image/png",byteSize:8,bytesBase64:"iVBORw0KGgo=",sha256:"a".repeat(64)};
 const result=await loadPublishedWishPreview(async(path,init)=>{assert.equal(path,"item-preview/"+itemId+"/3");assert.equal(init?.signal,sig);return payload;},target,sig);
 assert.equal(result.media.size,8);assert.equal(result.media.type,"image/png");
 await assert.rejects(loadPublishedWishPreview(async()=>({...payload,revision:4}),target,sig));
 await assert.rejects(loadPublishedWishPreview(async()=>({...payload,byteSize:9}),target,sig));
});

test("linked Item read pins exact revision and issues readonly render context only after success",async()=>{
 const target={itemId,revision:3},signal=new AbortController().signal;
 const record={id:itemId,key:"qa-item",displayName:"QA Item",type:"ACCESSORY",slot:"HEADWEAR",status:"PUBLISHED",revision:3,rarity:5,checkInItem:false,positionX:0,positionY:0,scale:1,rotationDegrees:null,asset:{key:"pinoria/item/uploads/"+"b".repeat(64)+".png",mimeType:"image/png",byteSize:8,sha256:"a".repeat(64)}};
 const loaded=await loadPublishedWishRecord(async(path,init)=>{assert.equal(path,"item-record/"+itemId+"/3");assert.equal(init?.signal,signal);return record;},target,signal);
 assert.equal(loaded.record.id,itemId);assert.equal(loaded.context.surface,"HO");assert.equal(loaded.context.authorize("pinoria.item.view"),true);assert.equal(loaded.context.authorize("pinoria.item.manage"),false);
 for(const wrong of [{...record,revision:4},{...record,status:"DRAFT"},{...record,type:"SET"},{...record,pendingDraft:{}},{...record,id:"0198d050-56c1-7ac5-b9ab-b0e45d912346"}])await assert.rejects(loadPublishedWishRecord(async()=>wrong,target,signal));
 const ctl=new AbortController();ctl.abort();await assert.rejects(loadPublishedWishRecord(async()=>record,target,ctl.signal));
 await assert.rejects(loadPublishedWishRecord(async()=>{throw Error("denied")},target,signal));
});
