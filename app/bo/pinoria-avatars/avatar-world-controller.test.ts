import test from "node:test";
import assert from "node:assert/strict";
import {createWorldTabController} from "./avatar-world-controller";
import type {WorldTabSnapshot} from "./avatar-world-controller";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const world={id:id(4),displayName:"QA",version:1,status:"ACTIVE",scenes:[]};
const data={...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:[world],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false}};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
const intent={kind:"grant",worldId:world.id,label:"QA"} as const;
test("scope-bound read and permission denial before network",async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json({data})};
 const denied=createWorldTabController(scope,new Set(),fetcher,()=> "qa",()=>{});
 await denied.reload();assert.equal(calls,0);assert.equal(denied.snapshot().status,"denied");
 const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa",()=>{});
 await ctl.reload();assert.equal(calls,1);assert.equal(ctl.snapshot().state?.centerId,scope.centerId);
});
test("dispose suppresses late publication and concurrent reads",async()=>{
 let calls=0;let finish:(r:Response)=>void=()=>{};
 const snapshots:WorldTabSnapshot[]=[];
 const fetcher:typeof fetch=async()=>{calls++;return new Promise(resolve=>{finish=resolve})};
 const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa",s=>snapshots.push(s));
 const run=ctl.reload();await ctl.reload();assert.equal(calls,1);
 const count=snapshots.length;ctl.dispose();finish(Response.json({data}));await run;
 assert.equal(snapshots.length,count);
});
test("failed readback preserves original operation and prevents duplicate command",async()=>{
 let posts=0,gets=0;const fetcher:typeof fetch=async(_url,init)=>{
  if(init?.method==="POST"){posts++;return Response.json({data:{instanceId:id(5),version:1}},{status:201})}
  gets++;return Response.json({data});
 };
 const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa-original",()=>{});
 await ctl.reload();await ctl.confirm(intent);
 assert.equal(posts,1);assert.equal(ctl.snapshot().pending?.key,"qa-original");assert.equal(ctl.snapshot().state,null);
 await ctl.reload();assert.equal(ctl.snapshot().status,"ready");assert.equal(ctl.snapshot().pending?.key,"qa-original");
 await ctl.confirm(intent);assert.equal(posts,1);assert.equal(gets,3);
});
test("successful separate readback clears lock and publishes confirmed instance",async()=>{
 let posts=0;const instance={id:id(5),worldId:world.id,studentProfileId:scope.studentProfileId,displayLabel:"QA",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:1,world,sceneAccess:{},unlockedLayerIds:[]};
 const fetcher:typeof fetch=async(_url,init)=>{
  if(init?.method==="POST"){posts++;return Response.json({data:{instanceId:instance.id,version:1}},{status:201})}
  return Response.json({data:posts?{...data,grantableWorlds:[],instances:[instance]}:data});
 };
 const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa",()=>{});
 await ctl.reload();await Promise.all([ctl.confirm(intent),ctl.confirm(intent)]);
 assert.equal(posts,1);assert.equal(ctl.snapshot().pending,null);assert.equal(ctl.snapshot().state?.instances[0]?.id,instance.id);
 ctl.open(instance.id);assert.equal(ctl.snapshot().instanceId,instance.id);ctl.back();assert.equal(ctl.snapshot().instanceId,null);
});
test("selected-Center denial blocks POST even when generic context grants the action",async()=>{
 let posts=0;
 const fetcher:typeof fetch=async(_url,init)=>{if(init?.method==="POST")posts++;return Response.json({data:{...data,capabilities:{grant:false,configure:false,setLive:false}}})};
 const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa",()=>{});
 await ctl.reload();assert.equal(ctl.snapshot().status,"ready");
 await ctl.confirm(intent);assert.equal(posts,0);assert.equal(ctl.snapshot().pending,null);
});
