import test from "node:test";
import assert from "node:assert/strict";
import {personalStarterIntent,verifyPersonalStarter} from "./starter-personal-contract";
const id="01900000-0000-7000-8000-000000000001",set="01900000-0000-7000-8000-000000000002",key="01900000-0000-7000-8000-000000000003";
const state={selfId:id,version:2,selfVersion:5,starterAvailable:true,starterSets:[{setItemId:set,membershipRevision:3,memberCount:3}]};
const base={selfId:id,version:8,ready:false,slots:{}};
const intent=personalStarterIntent(state,base,set,"  starter  ",key);
const receipt={selfId:id,version:3,selfVersion:6,setItemId:null,equipMode:"PERSONAL_SLOTS" as const,starterSetItemId:set,starterMembershipRevision:3,loadoutVersion:9};
const read={...state,version:3,selfVersion:6,setItemId:null,starterAvailable:false,starterSets:[]};
const saved={...base,version:9,ready:true,slots:{HAIR:{itemId:id},FACE:{itemId:key},OUTFIT:{itemId:set}}};
test("exact revisions and stable caller key",()=>{
 assert.deepEqual(intent,{key,selfId:id,body:{setItemId:set,expectedVersion:2,expectedSelfVersion:5,expectedMembershipRevision:3,expectedLoadoutVersion:8,reason:"starter"}});
 assert.deepEqual(personalStarterIntent(state,base,set,"starter",key),intent);
});
test("stale identity, unavailable or bogus choice fail before mutation",()=>{
 assert.throws(()=>personalStarterIntent({...state,starterAvailable:false},base,set,"starter",key));
 assert.throws(()=>personalStarterIntent(state,{...base,selfId:set},set,"starter",key));
 assert.throws(()=>personalStarterIntent(state,base,id,"starter",key));
 assert.throws(()=>personalStarterIntent(state,base,set," ",key));
});
test("personal receipt and independent readback must match",()=>{
 assert.doesNotThrow(()=>verifyPersonalStarter(intent,receipt,read,saved));
 assert.throws(()=>verifyPersonalStarter(intent,receipt,{...read,setItemId:set},saved));
 assert.throws(()=>verifyPersonalStarter(intent,receipt,{...read,starterAvailable:true},saved));
 assert.throws(()=>verifyPersonalStarter(intent,receipt,read,{...saved,ready:false}));
 assert.throws(()=>verifyPersonalStarter(intent,receipt,read,{...saved,version:8}));
 assert.throws(()=>verifyPersonalStarter(intent,{...receipt,starterMembershipRevision:4},read,saved));
 assert.throws(()=>verifyPersonalStarter(intent,receipt,read,{...saved,slots:{}}));
});
