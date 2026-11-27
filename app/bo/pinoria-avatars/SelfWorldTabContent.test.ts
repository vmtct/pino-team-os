import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {SelfWorldTabContent} from "./SelfWorldTabContent";
import {parseAvatarWorld} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const state=parseAvatarWorld({...scope,grantableWorlds:[{id:id(4),displayName:"World QA",version:1,status:"ACTIVE",scenes:[]}],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false}},scope);
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
const never=()=>{throw Error("render must not invoke callback")};
const props={scope,state,grants,status:"ready" as const,instanceId:null,busy:false,onReload:never,onOpen:never,onBack:never,onConfirm:never};
const render=(patch:Partial<Parameters<typeof SelfWorldTabContent>[0]>={})=>renderToStaticMarkup(createElement(SelfWorldTabContent,{...props,...patch}));
test("ready summary uses existing presentation and requires explicit action confirmation",()=>{
 const html=render();assert.match(html,/Chưa có World/);assert.match(html,/Cấp World · World QA/);assert.doesNotMatch(html,/Xác nhận thao tác/);
});
test("denied, loading, failed and mismatched scope never expose stale actions or catalog",()=>{
 for(const patch of [{status:"denied" as const},{status:"loading" as const},{status:"error" as const},{grants:new Set<string>()},{scope:{...scope,centerId:id(9)}},{state:null}]){
  assert.doesNotMatch(render(patch),/World QA|Thao tác World/);
 }
 assert.match(render({status:"loading"}),/Đang tải World/);
 assert.match(render({status:"error"}),/Thử lại/);
 assert.match(render({grants:new Set<string>()}),/Không có quyền/);
});
test("removed detail and busy state cannot expose grant as a fallback or enable mutation",()=>{
 const removed=render({instanceId:id(99)});assert.match(removed,/không còn khả dụng/);assert.doesNotMatch(removed,/Cấp World|Thao tác World/);
 assert.match(render({busy:true}),/aria-busy="true"/);assert.match(render({busy:true}),/disabled=""/);
});
test("uncertain receipt disables mutation without presenting read-only tab as loading",()=>{
 const html=render({mutationBlocked:true});
 assert.match(html,/aria-busy="false"/);assert.match(html,/disabled=""/);
 assert.match(html,/Chưa có World/);assert.match(html,/Cấp World · World QA/);
});
