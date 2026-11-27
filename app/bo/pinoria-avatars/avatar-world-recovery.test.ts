import test from "node:test";
import assert from "node:assert/strict";
import {createWorldOperationJournal} from "./avatar-world-journal";
import {createWorldTabController} from "./avatar-world-controller";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const world={id:id(4),displayName:"QA",version:1,status:"ACTIVE",scenes:[]};
const data={...scope,grantableWorlds:[world],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false}};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
const intent={kind:"grant",worldId:world.id,label:"QA"} as const;
const instance={id:id(5),worldId:world.id,studentProfileId:scope.studentProfileId,displayLabel:"QA",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:1,world,sceneAccess:{},unlockedLayerIds:[]};
const full={...data,grantableWorlds:[],instances:[instance]};
test("known receipt reconciles on explicit read-only reload after remount, never replays POST",async()=>{
 let posts=0,gets=0,available=false;
 const journal=createWorldOperationJournal();
 const fetcher:typeof fetch=async(_url,init)=>{
  if(init?.method==="POST"){posts++;return Response.json({data:{instanceId:instance.id,version:1}},{status:201})}
  gets++;return Response.json({data:available?full:data});
 };
 const first=createWorldTabController(scope,grants,fetcher,()=> "qa-first",()=>{},journal);
 await first.reload();await first.confirm(intent);
 assert.equal(first.snapshot().blocked,true);first.dispose();
 const next=createWorldTabController(scope,grants,fetcher,()=> "qa-next",()=>{},journal);
 await next.reload();assert.equal(next.snapshot().blocked,true);
 available=true;await next.reload();
 assert.equal(next.snapshot().blocked,false);assert.equal(next.snapshot().pending,null);
 assert.equal(next.snapshot().state?.instances[0]?.id,instance.id);assert.equal(posts,1);assert.equal(gets,4);
});
test("no receipt or wrong receipt never inferred from a matching state",async()=>{
 for(const receipt of [null,{instanceId:id(9),version:1},{instanceId:instance.id,version:2}]){
  let posts=0,available=false;const journal=createWorldOperationJournal();
  const fetcher:typeof fetch=async(_url,init)=>{
   if(init?.method==="POST"){posts++;if(receipt===null)throw Error("uncertain");return Response.json({data:receipt},{status:201})}
   return Response.json({data:available?full:data});
  };
  const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa",()=>{},journal);
  await ctl.reload();await ctl.confirm(intent);available=true;await ctl.reload();await ctl.confirm(intent);
  assert.equal(ctl.snapshot().blocked,true);assert.equal(posts,1);
 }
});
