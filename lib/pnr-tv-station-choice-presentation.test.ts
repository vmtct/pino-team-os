// PAP-655: isolated presentation candidate; no runtime/ACL assertions.
import test from "node:test";
import assert from "node:assert/strict";
import {visibleStationChoiceTurns,stationChoiceAction,type StationChoiceRead,type StationChoiceTurn} from "./pnr-tv-station-choice-presentation";
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
test("empty supply produces no panel turn; invalid, duplicated or excess offers are not rendered",()=>{
 for(const offers of [[],[turn.offers[0],turn.offers[0]],[{...turn.offers[0],pricePls:0}],[{...turn.offers[0],offerVersion:0}],[...turn.offers,...turn.offers]]){
  assert.deepEqual(visibleStationChoiceTurns(read([{...turn,offers}]),"center-a"),[]);
 }
 assert.deepEqual(visibleStationChoiceTurns(read([turn,turn]),"center-a"),[turn]);
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
