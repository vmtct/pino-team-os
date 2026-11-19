import test from "node:test";
import assert from "node:assert/strict";
import {parseWorldComposition,worldCompositionFrameKey} from "./avatar-world-composition";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const order=["AURA_GROUND","AURA_BACK","BACK","CHAR_BASE","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"];
const slots=Object.fromEntries(order.filter(s=>s!=="CHAR_BASE").map(s=>[s,null]));
const base={selfId:scope.selfId,version:0,ready:false,slots,renderStack:order};
const composition={selfId:scope.selfId,selfVersion:1,setVersion:0,ready:false,activeSet:null};
const raw={...scope,grantableWorlds:[],instances:[],loadout:base,composition};
const members=["HAIR","FACE","OUTFIT"].map((slot,n)=>({slot,itemId:id(n+10),displayName:slot,positionX:0,positionY:0,scale:1,rotationDegrees:null}));
const active={...composition,setVersion:1,ready:true,activeSet:{setItemId:id(20),version:1,membershipRevision:2,members}};
test("explicit empty Set and canonical active Set do not fall back to hidden slots",()=>{
 assert.equal(parseWorldComposition(raw,scope).activeSet,null);
 const p=parseWorldComposition({...raw,composition:active},scope);assert.equal(p.activeSet?.setItemId,id(20));assert.equal(p.activeSet?.members.length,3);assert.equal(p.loadout.slots.HAIR,null);
});
test("missing Set, foreign scope, invalid order, stale version, invalid geometry or incomplete Set fail closed",()=>{
 assert.throws(()=>parseWorldComposition({...raw,composition:undefined},scope));
 assert.throws(()=>parseWorldComposition(raw,{...scope,centerId:id(99)}));
 assert.throws(()=>parseWorldComposition({...raw,loadout:{...base,renderStack:[...order].reverse()}},scope));
 assert.throws(()=>parseWorldComposition({...raw,composition:{...active,setVersion:2}},scope));
 assert.throws(()=>parseWorldComposition({...raw,composition:{...active,activeSet:{...active.activeSet,members:[{...members[0],scale:0},...members.slice(1)]}}},scope));
 assert.throws(()=>parseWorldComposition({...raw,composition:{...active,activeSet:{...active.activeSet,members:members.slice(0,2)}}},scope));
});

test("PAP-2186 frame identity distinguishes member revision, order, replacement, clear and scope",()=>{
 const model=parseWorldComposition({...raw,composition:active},scope);
 const key=worldCompositionFrameKey(scope,model);
 const set=model.activeSet!;
 assert.equal(worldCompositionFrameKey({...scope},structuredClone(model)),key);
 assert.notEqual(worldCompositionFrameKey({...scope,studentProfileId:id(4)},model),key);
 assert.notEqual(worldCompositionFrameKey({...scope,centerId:id(5)},model),key);
 assert.notEqual(worldCompositionFrameKey(scope,{...model,activeSet:{...set,membershipRevision:3}}),key);
 assert.notEqual(worldCompositionFrameKey(scope,{...model,activeSet:{...set,members:[...set.members].reverse()}}),key);
 assert.notEqual(worldCompositionFrameKey(scope,{...model,activeSet:{...set,members:[{...set.members[0],itemId:id(99)},...set.members.slice(1)]}}),key);
 assert.notEqual(worldCompositionFrameKey(scope,{...model,activeSet:{...set,members:[{...set.members[0],scale:1.5},...set.members.slice(1)]}}),key);
 assert.notEqual(worldCompositionFrameKey(scope,{...model,activeSet:null}),key);
 const empty=parseWorldComposition(raw,scope);
 assert.notEqual(worldCompositionFrameKey(scope,{...empty,loadout:{...empty.loadout,slots:{...empty.loadout.slots,HAIR:set.members[0]}}}),worldCompositionFrameKey(scope,empty));
});
