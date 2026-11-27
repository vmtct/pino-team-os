import test from "node:test";
import assert from "node:assert/strict";
import {createPortfolioReadLifecycle} from "../src/portfolio-read-lifecycle.mjs";
const id=n=>"018f0000-0000-7000-8000-"+String(n).padStart(12,"0"),a=id(1),b=id(2);
function fixture(space="house"){
 let allowed=[a,b];const frames=[],requests=[];
 const lifecycle=createPortfolioReadLifecycle({space,authorizedStudents:()=>allowed,render:m=>frames.push(m),read:scope=>new Promise((resolve,reject)=>requests.push({...scope,resolve,reject}))});
 const ready=key=>({space,profileKey:key,state:"ready",posts:[{space,key:"post",caption:key??"self"}]});
 return {lifecycle,frames,requests,ready,restrict:ids=>{allowed=ids;}};
}
test("PAP-2432 selection clears immediately, cancels previous and rejects late response even without cancellation support",async()=>{
 const f=fixture(),old=f.lifecycle.select(a);
 assert.equal(f.frames.at(-1).state,"loading");
 const next=f.lifecycle.select(b);
 assert.deepEqual(f.frames.at(-1),{space:"house",state:"loading",profileKey:b,posts:[]});
 assert.equal(f.requests[0].signal.aborted,true);
 f.requests[1].resolve(f.ready(b));await next;
 f.requests[0].resolve(f.ready(a));await old;
 assert.deepEqual(f.frames.at(-1),f.ready(b));
});
test("PAP-2432 retry same scope and sanitize errors and non-ready models",async()=>{
 const f=fixture(),first=f.lifecycle.select(a);f.requests[0].reject(Error("private data"));await first;
 assert.equal(f.frames.at(-1).state,"error");
 const again=f.lifecycle.retry();assert.equal(f.requests[1].studentId,a);
 f.requests[1].resolve({...f.ready(a),state:"denied"});await again;
 assert.deepEqual(f.frames.at(-1),{space:"house",state:"denied",profileKey:a,posts:[]});
});
test("PAP-2432 unknown student and lost authorized profile never render old content",async()=>{
 const f=fixture();await f.lifecycle.select(id(9));assert.equal(f.requests.length,0);assert.equal(f.frames.at(-1).state,"no-profile");
 const pending=f.lifecycle.select(a);f.restrict([b]);f.requests[0].resolve(f.ready(a));await pending;
 assert.equal(f.frames.at(-1).state,"denied");assert.deepEqual(f.frames.at(-1).posts,[]);
 await f.lifecycle.retry();assert.equal(f.requests.length,1);
});
test("PAP-2432 profile and program mismatch fail closed",async()=>{
 const f=fixture(),one=f.lifecycle.select(a);f.requests[0].resolve(f.ready(b));await one;assert.equal(f.frames.at(-1).state,"error");
 const two=f.lifecycle.retry();f.requests[1].resolve({...f.ready(a),space:"mytime"});await two;assert.equal(f.frames.at(-1).state,"error");
});
test("PAP-2432 MyTime self-only and logout/pagehide cancels all late data",async()=>{
 const f=fixture("mytime");await f.lifecycle.select(a);assert.equal(f.requests.length,0);assert.equal(f.frames.at(-1).state,"denied");
 const p=f.lifecycle.select(null);assert.equal(f.requests[0].studentId,null);f.lifecycle.invalidate();assert.equal(f.requests[0].signal.aborted,true);
 f.requests[0].resolve(f.ready(null));await p;
 await f.lifecycle.select(null);await f.lifecycle.retry();
 assert.equal(f.requests.length,1);assert.deepEqual(f.frames.at(-1),{space:"mytime",state:"denied",profileKey:null,posts:[]});
});
