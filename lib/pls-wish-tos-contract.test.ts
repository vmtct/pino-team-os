import test from "node:test";
import assert from "node:assert/strict";
import {parseWishQuote,prepareWishConfirmation,parseWishReceipt,createWishAttempt,wishAttemptRequest} from "./pls-wish-tos-contract";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const scope={centerId:id(1),learnerId:id(2)};
const banner={bannerId:id(3),bannerRevisionId:id(4),policyRevisionId:id(5),familyId:"default",centerId:null,name:"Wish QA",unitCost:10,maxCount:8,pity:{since4:0,since5:0,guarantee:false}};
const quote={...scope,balance:85,visitId:id(7),status:"READY",banners:[banner]};
test("exact six-field Core payload; MAX from net balance, not client RNG",()=>{
 const confirmation=prepareWishConfirmation(quote,scope,id(4),"MAX");
 assert.deepEqual(confirmation,{payload:{...scope,policyRevisionId:id(5),bannerRevisionId:id(4),expectedCost:10,count:8},totalCost:80,quotedBalance:85,visitId:id(7)});
 assert.equal(prepareWishConfirmation(quote,scope,id(4),1).totalCost,10);
});
test("denies stale selection, invalid count and insufficient balance",()=>{
 for(const count of [0,9,11,1.5,NaN])assert.throws(()=>prepareWishConfirmation(quote,scope,id(4),count));
 assert.throws(()=>prepareWishConfirmation(quote,scope,id(9),1));
 assert.throws(()=>prepareWishConfirmation({...quote,balance:5,banners:[{...banner,maxCount:0}]},scope,id(4),"MAX"));
});
test("rejects wrong scope, wrong revision or malformed quote and inconsistent MAX",()=>{
 for(const q of [{...quote,centerId:id(8)},{...quote,balance:-1},{...quote,banners:[{...banner,centerId:id(8)}]},{...quote,banners:[{...banner,maxCount:9}]},{...quote,banners:[banner,banner]},{...quote,banners:[{...banner,pity:{since4:5,since5:2,guarantee:false}}]},{...quote,visitId:null}])assert.throws(()=>parseWishQuote(q,scope));
});
test("blocked quote states never authorize a confirmation",()=>{
 for(const status of ["SELF_REQUIRED","OPEN_VISIT_REQUIRED","NO_ACTIVE_CONFIGURATION"]){
  const q={...quote,status,visitId:status==="OPEN_VISIT_REQUIRED"?null:quote.visitId,banners:[]};
  assert.equal(parseWishQuote(q,scope).status,status);
  assert.throws(()=>prepareWishConfirmation(q,scope,id(4),1));
 }
});
test("global and own-Center banners honor one exact policy and MAX cap ten",()=>{
 const q={...quote,balance:1000,banners:[{...banner,maxCount:10},{...banner,bannerId:id(8),bannerRevisionId:id(9),centerId:scope.centerId,maxCount:10}]};
 assert.equal(prepareWishConfirmation(q,scope,id(9),"MAX").payload.count,10);
 assert.throws(()=>parseWishQuote({...q,banners:[q.banners[0],{...q.banners[1],policyRevisionId:id(10)}]},scope));
});

test("receipt validates exact settlement and preserves authoritative order and highest rarity",()=>{
 const payload=prepareWishConfirmation(quote,scope,id(4),2).payload;
 const first={ordinal:1,item_id:id(11),item_revision:2,rarity:5,duplicate:0,grant_event_id:id(12),before4:0,before5:0,before_featured:0,after4:0,after5:0,after_featured:0};
 const second={...first,ordinal:2,rarity:3,duplicate:1,grant_event_id:null,after4:1,after5:1};
 const receipt={eventId:id(13),balanceBefore:85,balanceAfter:65,unitCost:10,count:2,policyRevisionId:id(5),bannerRevisionId:id(4),replayed:false,outcomes:[first,second]};
 const r=parseWishReceipt(receipt,payload);
 assert.equal(r.highestRarity,5);assert.deepEqual(r.outcomes.map(o=>[o.ordinal,o.rarity,o.duplicate]),[[1,5,false],[2,3,true]]);
 assert.equal(parseWishReceipt({...receipt,replayed:true},payload).eventId,r.eventId);
 for(const bad of [{...receipt,balanceAfter:66},{...receipt,policyRevisionId:id(99)},{...receipt,outcomes:[second,first]},{...receipt,outcomes:[first,{...second,duplicate:0,grant_event_id:id(14)}]},{...receipt,outcomes:[first,{...second,before5:2}]},{...receipt,outcomes:[first,{...second,grant_event_id:id(14)}]}])assert.throws(()=>parseWishReceipt(bad,payload));
});
test("ambiguous retry reuses immutable exact request and idempotency key",()=>{
 const payload=prepareWishConfirmation(quote,scope,id(4),2).payload;
 const attempt=createWishAttempt(payload,"qa-attempt-1");
 const first=wishAttemptRequest(attempt),retry=wishAttemptRequest(attempt);
 assert.deepEqual(first,retry);assert.equal(new Headers(first.headers).get("idempotency-key"),"qa-attempt-1");
 assert.deepEqual(JSON.parse(String(first.body)),payload);assert.ok(Object.isFrozen(attempt.payload));
 assert.throws(()=>createWishAttempt(payload," "));
});

test("canonical stable family is a text key, not a UUID",()=>{
 assert.equal(parseWishQuote(quote,scope).banners[0]?.familyId,"default");
 for(const familyId of [""," default ","x".repeat(161)])assert.throws(()=>parseWishQuote({...quote,banners:[{...banner,familyId}]},scope));
});