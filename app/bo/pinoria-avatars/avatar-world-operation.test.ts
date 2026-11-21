import test from "node:test";
import assert from "node:assert/strict";
import {beginWorldOperation,resumeWorldOperation} from "./avatar-world-operation";
import type {AvatarWorldState} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const state:AvatarWorldState={selfId:id(1),centerId:id(2),studentProfileId:id(3),instances:[],grantableWorlds:[{id:id(4),displayName:"QA",status:"ACTIVE",version:2,scenes:[]}],loadoutVersion:0};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
test("operation retains exact immutable original scope and key for a matching retry",()=>{
 const intent={kind:"grant" as const,worldId:id(4),label:"QA"};
 const pending=beginWorldOperation(state,intent,grants,"qa-operation");
 intent.label="changed";
 assert.equal(pending.intent.kind,"grant");
 if(pending.intent.kind!=="grant")throw Error("Unexpected operation");
 assert.equal(pending.intent.label,"QA");
 assert.equal(pending.command.expectedVersion,2);
 assert.equal(resumeWorldOperation(pending,state,grants),pending);
 assert.ok(Object.isFrozen(pending.command)&&Object.isFrozen(pending.scope));
});
test("prevents rebinding a pending operation to a different Center, version or capability",()=>{
 const pending=beginWorldOperation(state,{kind:"grant",worldId:id(4),label:"QA"},grants,"qa-operation");
 assert.throws(()=>resumeWorldOperation(pending,{...state,centerId:id(5)},grants));
 assert.throws(()=>resumeWorldOperation(pending,{...state,grantableWorlds:state.grantableWorlds.map(w=>({...w,version:3}))},grants));
 assert.throws(()=>resumeWorldOperation(pending,state,new Set()));
});
