import test from "node:test";import assert from "node:assert/strict";
import {loadBoWishReward} from "./bo-pls-wish-reward-client";
import type {BoWishDetail} from "./pls-wish-bo-contract";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
test("reward media request binds event, Center, actor and ordinal, rejects wrong revision before network",async()=>{
 const event={eventId:id(1),centerId:id(2),outcomes:[{ordinal:1,itemId:id(3),itemRevision:4,rarity:5}]} as BoWishDetail;
 const target={itemId:id(3),revision:4},signal=new AbortController().signal;let count=0;
 const request=async(path:string,init:RequestInit)=>{count++;assert.equal(path,id(1)+"/reward-media/1?centerId="+id(2));assert.equal(new Headers(init.headers).get("x-pino-expected-actor"),id(4));assert.equal(init.signal,signal);return {itemId:id(3),revision:4,rarity:5,mimeType:"image/png",byteSize:8,bytesBase64:"iVBORw0KGgo="};};
 const r=await loadBoWishReward(request,event,1,target,id(2),id(4),signal);assert.equal(r.media.size,8);
 await assert.rejects(loadBoWishReward(request,event,1,{...target,revision:5},id(2),id(4),signal));await assert.rejects(loadBoWishReward(request,event,2,target,id(2),id(4),signal));await assert.rejects(loadBoWishReward(request,event,1,target,id(9),id(4),signal));assert.equal(count,1);
 await assert.rejects(loadBoWishReward(async()=>({rarity:4}),event,1,target,id(2),id(4),signal));
});
