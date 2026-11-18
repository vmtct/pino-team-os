import test from "node:test";
import assert from "node:assert/strict";
import {parseCommittedWishReveal,type CommittedWish} from "./pls-wish-reveal-contract";
const r={eventId:"event",policyRevisionId:"policy",highestRarity:5} as CommittedWish;
const good={eventId:r.eventId,policyRevisionId:r.policyRevisionId,highestRarity:5,mediaUrl:"https://assets.pinohouse.art/pinoria/reveal-5.mp4"};
test("reveal binds exact committed event, immutable policy and highest rarity",()=>{
 assert.equal(parseCommittedWishReveal(good,r),good.mediaUrl);assert.equal(parseCommittedWishReveal({...good,mediaUrl:null},r),null);
 for(const raw of [{...good,eventId:"other"},{...good,policyRevisionId:"other"},{...good,highestRarity:4},{...good,mediaUrl:"https://bad.example/a.mp4"},{...good,mediaUrl:good.mediaUrl+"?x=1"},{...good,mediaUrl:"https://assets.pinohouse.art/a.svg"}])assert.throws(()=>parseCommittedWishReveal(raw,r));
});
