/** PAP-2032: event-bound immutable reward preview, never current Item or HO API. */
import type {BoWishDetail} from "./pls-wish-bo-contract";
import {loadPublishedWishPreview} from "../app/ho/pinoria/wish-policies/wish-published-item-client";
import type {WishItemPreviewTarget} from "../app/ho/pinoria/wish-banners/wish-item-preview";
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function loadBoWishReward(request:(path:string,init:RequestInit)=>Promise<unknown>,event:BoWishDetail,ordinal:number,target:WishItemPreviewTarget,centerId:string,actor:string,signal:AbortSignal){
 const outcome=event.outcomes.find(o=>o.ordinal===ordinal);
 if(![event.eventId,centerId,actor].every(v=>id.test(v))||event.centerId!==centerId||!Number.isInteger(ordinal)||ordinal<1||ordinal>10||!outcome||outcome.itemId!==target.itemId||outcome.itemRevision!==target.revision)throw Error("Không xác minh được Item của Wish Event.");
 signal.throwIfAborted();
 return loadPublishedWishPreview(async()=>{const raw=await request(event.eventId+"/reward-media/"+ordinal+"?"+new URLSearchParams({centerId}),{signal,headers:{"x-pino-expected-actor":actor}});signal.throwIfAborted();if(!raw||typeof raw!=="object"||!("rarity" in raw)||raw.rarity!==outcome.rarity)throw Error("Rarity không khớp Wish Event.");return raw;},target,signal);
}
