import test from "node:test";
import assert from "node:assert/strict";
import {parseAvatarWorld,buildWorldCommand,verifyWorldReadback} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const w=(n:number)=>({id:id(n),displayName:"World "+n,status:"ACTIVE",version:2,scenes:[{id:id(n+1),worldId:id(n),displayName:"Scene",status:"ACTIVE",layers:[{id:id(n+1),sceneId:id(n+1),kind:"CHARACTER",displayName:"Avatar",enabled:true},{id:id(n+2),sceneId:id(n+1),kind:"MEDIA",displayName:"QA Layer",enabled:true}]}]});
const a=w(10),b=w(20);
const instance={id:id(100),studentProfileId:scope.studentProfileId,worldId:a.id,displayLabel:"World A",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:3,world:a,sceneAccess:{[id(11)]:true},unlockedLayerIds:[id(12)]};
const raw={...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:[b],instances:[instance],loadout:{selfId:scope.selfId,version:0,ready:false}};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant","pinoria.world.avatar.configure","pinoria.world.avatar.set_live"]);
test("same subject/Center and canonical projections only",()=>{
 const r=parseAvatarWorld(raw,scope);assert.equal(r.loadoutVersion,0);assert.equal(r.instances[0]?.world.id,a.id);
 for(const bad of [{...raw,centerId:id(8)},{...raw,loadout:{...raw.loadout,selfId:id(8)}},{...raw,instances:[{...instance,studentProfileId:id(8)}]},{...raw,instances:[{...instance,character:{}}]},{...raw,grantableWorlds:[a]},{...raw,instances:[{...instance,unlockedLayerIds:[id(11)]}]}])
  assert.throws(()=>parseAvatarWorld(bad,scope));
});
test("grant and CAS exact intent; no scope override or implicit permission",()=>{
 const state=parseAvatarWorld(raw,scope);
 assert.deepEqual(buildWorldCommand(state,{kind:"grant",worldId:b.id,label:" New "},grants),{kind:"grant",worldId:b.id,label:"New",expectedVersion:2});
 assert.deepEqual(buildWorldCommand(state,{kind:"scene",instanceId:instance.id,sceneId:id(11),accessible:false},grants),{kind:"scene",instanceId:instance.id,sceneId:id(11),accessible:false,expectedVersion:3});
 assert.throws(()=>buildWorldCommand(state,{kind:"live",instanceId:instance.id},new Set(["pinoria.world.avatar.set_live"])));
 assert.throws(()=>buildWorldCommand(state,{kind:"grant",worldId:a.id,label:"duplicate"},grants));
 assert.throws(()=>buildWorldCommand(state,{kind:"layer",instanceId:instance.id,layerId:id(11),unlocked:true},grants));
 const locked=parseAvatarWorld({...raw,instances:[{...instance,sceneAccess:{[id(11)]:false}}]},scope);
 assert.throws(()=>buildWorldCommand(locked,{kind:"layer",instanceId:instance.id,layerId:id(12),unlocked:true},grants));
});
test("receipt requires independent authoritative lock readback, including layer clearing",()=>{
 const before=parseAvatarWorld(raw,scope),cmd=buildWorldCommand(before,{kind:"scene",instanceId:instance.id,sceneId:id(11),accessible:false},grants),receipt={instanceId:instance.id,version:4};
 const afterRaw={...raw,instances:[{...instance,version:4,sceneAccess:{[id(11)]:false},unlockedLayerIds:[]}]};
 const after=parseAvatarWorld(afterRaw,scope);
 assert.equal(verifyWorldReadback(before,cmd,receipt,after).version,4);
 assert.throws(()=>verifyWorldReadback(before,cmd,receipt,before));
 assert.throws(()=>verifyWorldReadback(before,cmd,receipt,{...after,centerId:id(9)}));
 assert.throws(()=>verifyWorldReadback(before,cmd,receipt,parseAvatarWorld({...afterRaw,instances:[{...afterRaw.instances[0],unlockedLayerIds:[id(12)]}]},scope)));
});
test("set LIVE enforces one instance, grant requires INACTIVE and actual catalog readback",()=>{
 const before=parseAvatarWorld(raw,scope),cmd=buildWorldCommand(before,{kind:"grant",worldId:b.id,label:"B"},grants);
 const newInstance={...instance,id:id(101),worldId:b.id,world:b,displayLabel:"B",version:1,sceneAccess:{[id(21)]:false},unlockedLayerIds:[]};
 const after=parseAvatarWorld({...raw,grantableWorlds:[],instances:[instance,newInstance]},scope);
 assert.equal(verifyWorldReadback(before,cmd,{instanceId:id(101),version:1},after).id,id(101));
 assert.throws(()=>parseAvatarWorld({...raw,grantableWorlds:[],instances:[{...instance,status:"LIVE"},{...newInstance,status:"LIVE"}]},scope));
 assert.throws(()=>verifyWorldReadback(before,cmd,{instanceId:id(101),version:1},before));
});
test("Core selected-Center capability is mandatory and independently restricts every command",()=>{
 for(const capabilities of [undefined,null,{}, {grant:true,configure:false,setLive:"true"},{grant:true,configure:false,setLive:true,extra:true}])assert.throws(()=>parseAvatarWorld({...raw,capabilities},scope));
 const state=parseAvatarWorld({...raw,capabilities:{grant:false,configure:true,setLive:false}},scope);
 assert.throws(()=>buildWorldCommand(state,{kind:"grant",worldId:b.id,label:"B"},grants));
 assert.throws(()=>buildWorldCommand(state,{kind:"live",instanceId:instance.id},grants));
 assert.equal(buildWorldCommand(state,{kind:"scene",instanceId:instance.id,sceneId:id(11),accessible:false},grants).kind,"scene");
 assert.throws(()=>buildWorldCommand(state,{kind:"scene",instanceId:instance.id,sceneId:id(11),accessible:false},new Set()));
});
