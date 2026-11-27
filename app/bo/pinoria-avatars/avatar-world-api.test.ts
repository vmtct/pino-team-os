import test from "node:test";
import assert from "node:assert/strict";
import {loadAvatarWorld,mutateAvatarWorld,AvatarWorldApiError} from "./avatar-world-api";
import {parseAvatarWorld} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const world={id:id(10),displayName:"World",status:"ACTIVE",version:2,scenes:[]};
const renderStack=["AURA_GROUND","AURA_BACK","BACK","CHAR_BASE","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"];const slots=Object.fromEntries(renderStack.filter(s=>s!=="CHAR_BASE").map(s=>[s,null]));
const empty={...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:[world],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false,slots,renderStack},composition:{selfId:scope.selfId,selfVersion:1,setVersion:0,ready:false,activeSet:null}};
const instance={id:id(11),worldId:world.id,studentProfileId:scope.studentProfileId,displayLabel:"QA World",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:1,world,sceneAccess:{},unlockedLayerIds:[]};
const full={...empty,grantableWorlds:[],instances:[instance]};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
const previous=parseAvatarWorld(empty,scope),intent={kind:"grant",worldId:world.id,label:"QA World"} as const;
const signal=new AbortController().signal;
test("BO selected-Center request sends only expected fields and checks separate readback",async()=>{
 const calls:{url:string,init?:RequestInit}[]=[];
 const fetcher:typeof fetch=async(input,init)=>{calls.push({url:String(input),init});return init?.method==="POST"?Response.json({data:{instanceId:instance.id,version:1}},{status:201}):Response.json({data:{...full,loadout:{selfId:scope.selfId,version:0,ready:false},composition:undefined}});};
 const result=await mutateAvatarWorld(previous,intent,grants,"qa-replay-1",fetcher,signal);
 assert.equal(result.instance.id,instance.id);assert.equal(result.state.instances[0]?.id,instance.id);assert.equal(Object.hasOwn(result,"snapshot"),false);assert.equal(calls.length,2);
 assert.equal(calls[0]?.url,"/api/bo/pinoria/avatars/"+scope.selfId+"/world/commands?centerId="+scope.centerId);
 assert.equal(calls[1]?.url,"/api/bo/pinoria/avatars/"+scope.selfId+"/world?centerId="+scope.centerId);
 assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)),{kind:"grant",worldId:world.id,label:"QA World",expectedVersion:2});
 assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"),"qa-replay-1");
 assert.equal(calls[1]?.init?.method,"GET");assert.equal(calls[0]?.init?.signal,signal);
 assert.equal(calls[0]?.init?.redirect,"error");assert.equal(calls[0]?.init?.cache,"no-store");
});
test("denial and conflict no retry/no readback success, no implicit grant calls",async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json({error:{message:"raw internal details"}},{status:409,headers:{"x-request-id":"qa"}});};
 await assert.rejects(mutateAvatarWorld(previous,intent,grants,"qa",fetcher,signal),(e:unknown)=>e instanceof AvatarWorldApiError&&e.status===409&&e.requestId==="qa"&&!e.message.includes("raw internal"));
 assert.equal(calls,1);
 await assert.rejects(mutateAvatarWorld(previous,intent,new Set(),"qa",fetcher,signal));
 await assert.rejects(mutateAvatarWorld(previous,intent,grants,"",fetcher,signal));assert.equal(calls,1);
});
test("scope mismatch or stale readback never presented as authorized success",async()=>{
 let calls=0;const fetcher:typeof fetch=async(_input,init)=>{calls++;return init?.method==="POST"?Response.json({data:{instanceId:instance.id,version:1}},{status:201}):Response.json({data:empty});};
 await assert.rejects(mutateAvatarWorld(previous,intent,grants,"qa",fetcher,signal));assert.equal(calls,2);
 await assert.rejects(loadAvatarWorld(scope,async()=>Response.json({data:{...full,centerId:id(44)}}),signal));
 await assert.rejects(loadAvatarWorld(scope,async()=>Response.json({data:full},{status:403}),signal),(e:unknown)=>e instanceof AvatarWorldApiError&&e.status===403);
});



test("management-only readback works without any composition or preview response",async()=>{
 const data={...full,loadout:{selfId:scope.selfId,version:0,ready:false},composition:undefined};
 let calls=0;
 const fetcher:typeof fetch=async(_input,init)=>{calls++;return init?.method==="POST"?Response.json({data:{instanceId:instance.id,version:1}},{status:201}):Response.json({data});};
 const result=await mutateAvatarWorld(previous,intent,grants,"qa",fetcher,signal);
 assert.equal(result.state.instances[0]?.id,instance.id);
 assert.equal(Object.hasOwn(result,"snapshot"),false);
 assert.equal(calls,2);
});
