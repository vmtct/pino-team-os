import test from "node:test";
import assert from "node:assert/strict";
import {parseAvatarWorld} from "./avatar-world-contract";
import {worldChoices} from "./avatar-world-choices";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const scene={id:id(11),worldId:id(10),displayName:"Cảnh QA",status:"ACTIVE",layers:[{id:id(11),sceneId:id(11),kind:"CHARACTER",displayName:"Avatar",enabled:true},{id:id(12),sceneId:id(11),kind:"MEDIA",displayName:"QA Layer",enabled:true}]};
const world={id:id(10),displayName:"World QA",version:2,status:"ACTIVE",scenes:[scene]};
const other={id:id(20),displayName:"World mới",version:1,status:"ACTIVE",scenes:[]};
const instance={id:id(100),studentProfileId:scope.studentProfileId,worldId:world.id,displayLabel:"QA",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:3,world,sceneAccess:{[scene.id]:true},unlockedLayerIds:[id(12)]};
const raw={...scope,grantableWorlds:[other],instances:[instance],loadout:{selfId:scope.selfId,version:1,ready:true}};
const view=["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view"];
const all=new Set([...view,"pinoria.world.avatar.grant","pinoria.world.avatar.configure","pinoria.world.avatar.set_live"]);
test("scope and explicit independent permissions gate all presentation choices",()=>{
 const state=parseAvatarWorld(raw,scope);
 assert.deepEqual(worldChoices(scope,state,new Set(view),null),[]);
 assert.deepEqual(worldChoices(scope,state,new Set(view),instance.id),[]);
 assert.deepEqual(worldChoices({...scope,centerId:id(9)},state,all,instance.id),[]);
 assert.equal(worldChoices(scope,state,all,null).length,1);
 assert.deepEqual(worldChoices(scope,state,all,instance.id).map(c=>c.intent.kind),["live","scene","layer"]);
 assert.equal(worldChoices(scope,state,new Set([...view,"pinoria.world.avatar.set_live"]),instance.id).length,1);
});
test("locked scene cannot unlock media, character is never a command, revoked has no choices",()=>{
 const locked=parseAvatarWorld({...raw,instances:[{...instance,sceneAccess:{[scene.id]:false},unlockedLayerIds:[]}]},scope);
 assert.deepEqual(worldChoices(scope,locked,all,instance.id).map(c=>c.intent.kind),["live","scene"]);
 const revoked=parseAvatarWorld({...raw,instances:[{...instance,status:"REVOKED",revokedAt:"2026-11-18T01:00:00Z"}]},scope);
 assert.deepEqual(worldChoices(scope,revoked,all,instance.id),[]);
});
