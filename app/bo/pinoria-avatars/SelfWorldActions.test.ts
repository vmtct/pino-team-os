import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {SelfWorldActions} from "./SelfWorldActions";
import {parseAvatarWorld} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const state=parseAvatarWorld({...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:[{id:id(4),displayName:"World QA",version:1,status:"ACTIVE",scenes:[]}],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false}},scope);
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
const props={scope,state,grants,instanceId:null,busy:false,onConfirm:()=>{throw Error("render must not submit")}};
test("World action panel hides denied and foreign scope, offers authorized grant without auto submit",()=>{
 assert.equal(renderToStaticMarkup(createElement(SelfWorldActions,{...props,grants:new Set<string>()})),"");
 assert.equal(renderToStaticMarkup(createElement(SelfWorldActions,{...props,scope:{...scope,centerId:id(9)}})),"");
 const html=renderToStaticMarkup(createElement(SelfWorldActions,props));
 assert.match(html,/data-world-grant-toolbar/);assert.match(html,/class="pds-property-input"/);assert.match(html,/class="pds-property-label"/);
 assert.match(html,/Chọn World để cấp/);assert.doesNotMatch(html,/Xác nhận thao tác/);
 assert.match(renderToStaticMarkup(createElement(SelfWorldActions,{...props,busy:true})),/disabled=""/);
});

test("PAP-2153 original Scene and Layer checkbox reflect saved state and preserve permission controls",()=>{
 const scene=id(30),layer=id(31),world=id(32),instance=id(33);
 const seeded=parseAvatarWorld({...scope,capabilities:state.capabilities,grantableWorlds:[],instances:[{id:instance,worldId:world,studentProfileId:scope.studentProfileId,displayLabel:"Chromia",status:"LIVE",version:1,grantedAt:"2026-11-17T00:00:00Z",revokedAt:null,createdAt:"2026-11-17T00:00:00Z",updatedAt:"2026-11-17T00:00:00Z",createdByUser:null,updatedByUser:null,world:{id:world,displayName:"Chromia",status:"ACTIVE",version:1,scenes:[{id:scene,worldId:world,displayName:"Prism Lighthouse",status:"ACTIVE",layers:[{id:scene,sceneId:scene,displayName:"Anchor",kind:"CHARACTER",enabled:true},{id:layer,sceneId:scene,displayName:"Star",kind:"MEDIA",enabled:true}]}]},sceneAccess:{[scene]:false},unlockedLayerIds:[]}],loadout:{selfId:scope.selfId,version:1,ready:true}},scope);
 const html=renderToStaticMarkup(createElement(SelfWorldActions,{...props,state:seeded,instanceId:instance,grants:new Set([...grants,"pinoria.world.avatar.configure"])}));
 assert.match(html,/data-world-scene=/);assert.match(html,/data-world-layer=/);assert.match(html,/data-world-layer="[^"]+" disabled=""/);assert.doesNotMatch(html,/Anchor/);
 const readonly=renderToStaticMarkup(createElement(SelfWorldActions,{...props,state:seeded,instanceId:instance,grants}));
 assert.match(readonly,/data-world-scene="[^"]+" disabled=""/);assert.doesNotMatch(readonly,/Xác nhận thao tác/);
});
