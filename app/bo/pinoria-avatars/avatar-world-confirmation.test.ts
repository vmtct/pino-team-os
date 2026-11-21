import test from "node:test";
import assert from "node:assert/strict";
import {worldConfirmationStamp} from "./avatar-world-confirmation";
import {parseAvatarWorld} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const world={id:id(10),displayName:"World QA",status:"ACTIVE",version:2,scenes:[]};
const raw={...scope,grantableWorlds:[world],instances:[],loadout:{selfId:scope.selfId,version:1,ready:true}};
test("confirmation stamp rejects refreshed version, selected scope and capability changes",()=>{
 const a=parseAvatarWorld(raw,scope),g=new Set(["view","grant"]),stamp=worldConfirmationStamp(a,g);
 assert.equal(worldConfirmationStamp(parseAvatarWorld(raw,scope),new Set(["grant","view"])),stamp);
 assert.notEqual(worldConfirmationStamp(parseAvatarWorld({...raw,grantableWorlds:[{...world,version:3}]},scope),g),stamp);
 assert.notEqual(worldConfirmationStamp({...a,centerId:id(9)},g),stamp);
 assert.notEqual(worldConfirmationStamp(a,new Set(["view"])),stamp);
 assert.notEqual(worldConfirmationStamp({...a,loadoutVersion:2},g),stamp);
});
