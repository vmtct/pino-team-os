import test from "node:test";
import assert from "node:assert/strict";
import {runRunningClassControl} from "./running-class-control-fence";
test("synchronous preview remains synchronous",()=>{
 const lock={current:false},events:unknown[]=[];
 assert.equal(runRunningClassControl(lock,b=>events.push(b),()=>{events.push("write");},e=>events.push(e)),true);
 assert.deepEqual(events,[true,"write",false,null]);assert.equal(lock.current,false);
});
test("pending async operation blocks duplicate and reports rejection before releasing",async()=>{
 const lock={current:false},events:unknown[]=[];let reject!:(e:Error)=>void;
 const promise=new Promise<void>((_,r)=>{reject=r;});
 assert.equal(runRunningClassControl(lock,b=>events.push(b),()=>promise,e=>events.push(e)),true);
 assert.equal(runRunningClassControl(lock,()=>{},()=>{throw Error("duplicate");},()=>{}),false);
 assert.equal(lock.current,true);const error=Error("conflict");reject(error);await promise.catch(()=>{});
 assert.deepEqual(events,[true,false,error]);assert.equal(lock.current,false);
});
