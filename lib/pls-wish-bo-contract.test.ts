import test from "node:test";
import assert from "node:assert/strict";
import {parseBoWishEvent,parseBoWishList,parseBoWishDetail,prepareWishInvalidation,confirmWishInvalidation} from "./pls-wish-bo-contract";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const at="2026-11-17T00:00:00.000Z";
const event={eventId:id(1),learnerId:id(2),selfId:id(3),centerId:id(4),actorUserId:id(5),visitId:id(6),createdAt:at,count:2,unitCost:10,spent:20,balanceBefore:100,balanceAfter:80,policyRevisionId:id(7),bannerRevisionId:id(8),familyId:"default",highestRarity:5,status:"COMMITTED",reversedAt:null,reversedBy:null,reversalReason:null,learnerName:"QA",learnerGender:null,centerName:"QA Center",actorName:null,reversedByName:null,policyName:"Policy",bannerName:"Banner"};
const first={ordinal:1,item_id:id(10),item_revision:1,rarity:5,duplicate:0,grant_event_id:id(11),before4:0,before5:0,before_featured:0,after4:0,after5:0,after_featured:0,itemName:"QA Item",provenance:"WISH_DRAW"};
const second={...first,ordinal:2,duplicate:1,grant_event_id:null,provenance:null};
const detail={...event,outcomes:[first,second]};
test("center-bound event retains null labels and exact immutable PLS receipt",()=>{
 const r=parseBoWishEvent(event,{centerId:id(4)});assert.equal(r.actorName,null);assert.equal(r.spent,20);
 for(const bad of [{...event,centerId:id(99)},{...event,spent:21},{...event,status:"INVALIDATED"},{...event,learnerGender:"unknown"}])assert.throws(()=>parseBoWishEvent(bad,{centerId:id(4)}));
});
test("list cursor enforces canonical descending order and unique IDs",()=>{
 const newer={...event,eventId:id(20)};
 assert.equal(parseBoWishList([newer,event],{centerId:id(4)},2).length,2);
 for(const list of [[event,newer],[event,event]])assert.throws(()=>parseBoWishList(list,{centerId:id(4)},2));
 assert.throws(()=>parseBoWishList([newer],{centerId:id(4)},1,{createdAt:at,eventId:id(1)}));
});
test("detail preserves ordered grant, duplicate and missing label semantics",()=>{
 const r=parseBoWishDetail(detail,id(4),id(1));assert.equal(r.outcomes[1]?.grantEventId,null);
 assert.throws(()=>parseBoWishDetail({...detail,highestRarity:4},id(4),id(1)));
 assert.throws(()=>parseBoWishDetail({...detail,outcomes:[first,{...second,provenance:"WISH_DRAW"}]},id(4),id(1)));
 assert.throws(()=>parseBoWishDetail(detail,id(4),id(9)));
});
test("invalidation exact refund, immutable reason, committed readback and no double action",()=>{
 const attempt=prepareWishInvalidation(parseBoWishDetail(detail,id(4),id(1))," QA reason ","qa-invalidate");
 assert.deepEqual(attempt.body,{eventId:id(1),centerId:id(4),reason:"QA reason"});
 assert.deepEqual(attempt.affectedGrants,[id(11)]);assert.equal(attempt.expectedRefund,20);
 const receipt={eventId:id(1),refund:20,reason:"QA reason",replayed:false};
 const reversed={...detail,status:"INVALIDATED",reversedAt:"2026-11-17T00:01:00.000Z",reversedBy:id(12),reversalReason:"QA reason"};
 assert.equal(confirmWishInvalidation(attempt,receipt,reversed,parseBoWishDetail(detail,id(4),id(1))).status,"INVALIDATED");
 assert.throws(()=>confirmWishInvalidation(attempt,{...receipt,refund:19},reversed,parseBoWishDetail(detail,id(4),id(1))));
 assert.throws(()=>confirmWishInvalidation(attempt,receipt,detail,parseBoWishDetail(detail,id(4),id(1))));
 assert.throws(()=>confirmWishInvalidation(attempt,receipt,{...reversed,actorUserId:id(99)},parseBoWishDetail(detail,id(4),id(1))));
 assert.throws(()=>confirmWishInvalidation(attempt,receipt,{...reversed,outcomes:[{...first,item_revision:2},{...second,item_revision:2}]},parseBoWishDetail(detail,id(4),id(1))));
 assert.throws(()=>prepareWishInvalidation(parseBoWishDetail(reversed,id(4),id(1)),"Again","other"));
});

import {scopedWishInvalidationJournal} from "./pls-wish-bo-journal-scope";
test("BO reversal journal rejects stale actor or selected Center without read/write/complete",async()=>{
 const e=parseBoWishDetail(detail,id(4),id(1)),a=prepareWishInvalidation(e,"QA","same");
 let allowed=true,pending:typeof a|null=null,calls=0;
 const journal=scopedWishInvalidationJournal({async read(){calls++;return pending;},async reserve(_e,n){calls++;pending=n;},async complete(){calls++;pending=null;}},id(4),async()=>{if(!allowed)throw Error("Actor changed");});
 await journal.reserve(e,a);assert.equal(pending,a);
 allowed=false;await assert.rejects(journal.read(e));await assert.rejects(journal.complete(e,a));await assert.rejects(journal.reserve(e,a));assert.equal(calls,1);assert.equal(pending,a);
 allowed=true;await assert.rejects(journal.read({...e,centerId:id(99)}));await assert.rejects(journal.complete({...e,eventId:id(99)},a));assert.equal(calls,1);
 assert.equal(await journal.read(e),a);await journal.complete(e,a);assert.equal(pending,null);
});
