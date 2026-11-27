import test from "node:test";
import assert from "node:assert/strict";
import {worldScope,WORLD_PERMISSIONS} from "./SelfWorldNative";
import {selfDefinition,verifySelfWardrobeApproval} from "./schema";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const row={pinoriaSelfId:id(1),studentProfileId:id(2),personId:id(3),selfStatus:"ACTIVE",subjectStatus:"ACTIVE"};
test("World binding requires valid linked learner and active Self, never staff-only",()=>{
 assert.deepEqual(worldScope(row,id(4)),{selfId:id(1),studentProfileId:id(2),centerId:id(4)});
 for(const patch of [{studentProfileId:null},{personId:null},{pinoriaSelfId:null},{selfStatus:"ARCHIVED"},{subjectStatus:"INACTIVE"}])assert.equal(worldScope({...row,...patch},id(4)),null);
 assert.equal(worldScope(row,"bad"),null);assert.equal(WORLD_PERMISSIONS.length,6);
});
test("native schema adds approved World tab without replacing wardrobe/loadout",()=>{
 assert.deepEqual(selfDefinition.detail.businessTabs.map(t=>t.id),["wardrobe","loadout","world"]);
 const tab=selfDefinition.detail.businessTabs[2];
 assert.equal(tab.source.permission,"pinoria.world.avatar.view");
 const scope={surface:"BO",key:"pinoria-avatars",extensionId:tab.extensionId} as const;
 assert.equal(verifySelfWardrobeApproval(tab.approval,scope),true);
 assert.equal(verifySelfWardrobeApproval({...tab.approval,jira:"PAP-0"},scope),false);
});
