// PAP-655: isolated presentation candidate; no runtime/ACL assertions.
import test from "node:test";
import assert from "node:assert/strict";
import {canMountStationQuickChoice,visibleStationChoiceTurns,stationChoiceAction,type StationChoiceRead,type StationChoiceTurn} from "./pnr-tv-station-choice-presentation";
const turn:StationChoiceTurn={visitId:"visit-a",centerId:"center-a",learnerName:"Demo Learner",balancePls:30,offers:[
  {offerId:"o1",itemId:"i1",offerVersion:2,itemRevision:3,displayName:"Hat",pricePls:20,imageUrl:null},
  {offerId:"o2",itemId:"i2",offerVersion:1,itemRevision:1,displayName:"Glasses",pricePls:40,imageUrl:null}
]};
const read=(t:readonly StationChoiceTurn[]=[turn]):StationChoiceRead=>({centerId:"center-a",status:"ready",turns:t});
test("only matching ready Center projection is rendered",()=>{
 assert.deepEqual(visibleStationChoiceTurns(read(),"center-a"),[turn]);
 for(const status of ["unverified","loading","error"] as const)
  assert.deepEqual(visibleStationChoiceTurns({...read(),status},"center-a"),[]);
 assert.deepEqual(visibleStationChoiceTurns(read(),"center-b"),[]);
 assert.deepEqual(visibleStationChoiceTurns(read(),null),[]);
 assert.deepEqual(visibleStationChoiceTurns(read([{...turn,centerId:"center-b"}]),"center-a"),[]);
});
test("zero offers keeps a valid turn available for explicit skip only",()=>{
 const empty={...turn,offers:[]};
 assert.deepEqual(visibleStationChoiceTurns(read([empty]),"center-a"),[empty]);
 assert.equal(stationChoiceAction(empty,"o1"),null);
 assert.deepEqual(stationChoiceAction(empty,null),{kind:"skip",visitId:"visit-a",centerId:"center-a"});
 assert.deepEqual(visibleStationChoiceTurns(read([empty]),"center-b"),[]);
});
test("invalid, duplicated or excess offers are not rendered",()=>{
 for(const offers of [[turn.offers[0],turn.offers[0]],[{...turn.offers[0],pricePls:0}],[{...turn.offers[0],offerVersion:0}],[...turn.offers,...turn.offers]]){
  assert.deepEqual(visibleStationChoiceTurns(read([{...turn,offers}]),"center-a"),[]);
 }
 assert.deepEqual(visibleStationChoiceTurns(read([turn,turn]),"center-a"),[turn]);
});
test("conflicting same-Visit projections hide only the ambiguous turn",()=>{
 const other={...turn,visitId:"visit-b"};
 const changedBalance={...turn,balancePls:31};
 const changedOffer={...turn,offers:[{...turn.offers[0],offerVersion:3},turn.offers[1]]};
 for(const conflicting of [changedBalance,changedOffer]) {
  assert.deepEqual(visibleStationChoiceTurns(read([turn,other,conflicting]),"center-a"),[other]);
  assert.deepEqual(visibleStationChoiceTurns(read([conflicting,other,turn]),"center-a"),[other]);
 }
});
test("invalid balances and unnamed learner do not render",()=>{
 for(const balancePls of [-1,NaN,1.5])assert.deepEqual(visibleStationChoiceTurns(read([{...turn,balancePls}]),"center-a"),[]);
 assert.deepEqual(visibleStationChoiceTurns(read([{...turn,learnerName:" "}]),"center-a"),[]);
});
test("purchase emits exact confirmed identifiers and expected version/price, no invented or unaffordable selection",()=>{
 assert.deepEqual(stationChoiceAction(turn,"o1"),{kind:"purchase",visitId:"visit-a",centerId:"center-a",offerId:"o1",offerVersion:2,itemRevision:3,pricePls:20});
 assert.equal(stationChoiceAction(turn,"o2"),null);
 assert.equal(stationChoiceAction(turn,"unknown"),null);
});
test("skip emits exact Visit and Center only and changes no input",()=>{
 const before=JSON.stringify(turn);
 assert.deepEqual(stationChoiceAction(turn,null),{kind:"skip",visitId:"visit-a",centerId:"center-a"});
 assert.equal(JSON.stringify(turn),before);
});

test("Station overview host requires supplied projection and an authorized matching Center",()=>{
 assert.equal(canMountStationQuickChoice("overview","center-a",["center-a"],read()),true);
 assert.equal(canMountStationQuickChoice("overview","center-a",["center-a"],undefined),false);
 assert.equal(canMountStationQuickChoice("overview","center-a",[],read()),false);
 assert.equal(canMountStationQuickChoice("overview","center-b",["center-b"],read()),false);
 assert.equal(canMountStationQuickChoice("overview",null,["center-a"],read()),false);
 assert.equal(canMountStationQuickChoice("overview","center-a",["center-a"],{...read(),status:"unverified"}),false);
 for(const tab of ["pinoria","students","devices","tv","reception"])
  assert.equal(canMountStationQuickChoice(tab,"center-a",["center-a"],read()),false);
});

test("PAP-2021 rejects invalid direct action candidates before emitting an intent",()=>{
 const o=turn.offers[0];
 const bad:StationChoiceTurn[]=[
 {...turn,visitId:" "},{...turn,centerId:""},{...turn,learnerName:" "},
 {...turn,balancePls:-1},{...turn,balancePls:NaN},{...turn,balancePls:1.5},
 {...turn,offers:[{...o,offerId:" "}]},{...turn,offers:[{...o,itemId:" "}]},
 {...turn,offers:[{...o,pricePls:-1}]},{...turn,offers:[{...o,offerVersion:0}]},
 {...turn,offers:[{...o,itemRevision:1.5}]},{...turn,offers:[o,o]},
 {...turn,offers:[o,{...o,offerId:"other"}]},
 {...turn,offers:[o,{...o,offerId:"2",itemId:"2"},{...o,offerId:"3",itemId:"3"},{...o,offerId:"4",itemId:"4"}]}
 ];
 for(const candidate of bad){
  assert.equal(stationChoiceAction(candidate,null),null);
  assert.equal(stationChoiceAction(candidate,candidate.offers[0]?.offerId??"o1"),null);
  assert.deepEqual(visibleStationChoiceTurns(read([candidate]),candidate.centerId),[]);
 }
});
