import test from "node:test";
import assert from "node:assert/strict";
import {createWorldOperationJournal} from "./avatar-world-journal";
import {createWorldTabController} from "./avatar-world-controller";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const world={id:id(4),displayName:"QA",version:1,status:"ACTIVE",scenes:[]};
const data={...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:[world],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false}};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
const intent={kind:"grant",worldId:world.id,label:"QA"} as const;
test("uncertain operation survives remount and Center switch, with no duplicate POST",async()=>{
 let posts=0;
 const journal=createWorldOperationJournal();
 const fetcher:typeof fetch=async(_url,init)=>{
  if(init?.method==="POST"){posts++;throw Error("uncertain")}
  return Response.json({data});
 };
 const ctl=createWorldTabController(scope,grants,fetcher,()=> "qa-original",()=>{},journal);
 await ctl.reload();await ctl.confirm(intent);ctl.dispose();
 const next=createWorldTabController(scope,grants,fetcher,()=> "qa-new",()=>{},journal);
 await next.reload();await next.confirm(intent);
 assert.equal(posts,1);assert.equal(next.snapshot().pending?.key,"qa-original");
 const other={...scope,centerId:id(9)};
 const switched=createWorldTabController(other,grants,async()=>Response.json({data:{...data,...other}}),()=> "qa-other",()=>{},journal);
 await switched.reload();await switched.confirm(intent);
 assert.equal(posts,1);assert.equal(switched.snapshot().pending,null);assert.equal(switched.snapshot().blocked,true);
});
test("shared journal serializes simultaneous controllers and releases only exact operation",async()=>{
 let posts=0;
 const journal=createWorldOperationJournal();
 const instance={id:id(5),worldId:world.id,studentProfileId:scope.studentProfileId,displayLabel:"QA",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:1,world,sceneAccess:{},unlockedLayerIds:[]};
 const fetcher:typeof fetch=async(_url,init)=>{
  if(init?.method==="POST"){posts++;return Response.json({data:{instanceId:instance.id,version:1}},{status:201})}
  return Response.json({data:posts?{...data,grantableWorlds:[],instances:[instance]}:data});
 };
 const a=createWorldTabController(scope,grants,fetcher,()=> "qa-a",()=>{},journal);
 const b=createWorldTabController(scope,grants,fetcher,()=> "qa-b",()=>{},journal);
 await Promise.all([a.reload(),b.reload()]);
 const run=a.confirm(intent);
 const pending=journal.pending(scope);assert.ok(pending);
 assert.equal(journal.complete({...pending}),false);
 await Promise.all([run,b.confirm(intent)]);
 assert.equal(posts,1);assert.equal(journal.pending(scope),null);assert.equal(a.snapshot().blocked,false);
 await b.reload();assert.equal(b.snapshot().blocked,false);
});
