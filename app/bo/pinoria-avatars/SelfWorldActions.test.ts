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
 assert.match(html,/Cấp World · World QA/);assert.doesNotMatch(html,/Xác nhận thao tác/);
 assert.match(renderToStaticMarkup(createElement(SelfWorldActions,{...props,busy:true})),/disabled=""/);
});
