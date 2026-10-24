const {test}=require("node:test");
const assert=require("node:assert/strict");
const {create}=require("./bo-history.js");
const e=(id="1",type="student",subject="A",at="2026-10-24T09:00:00Z")=>({id,subject_type:type,subject_id:subject,occurred_at:at,actor_id:"fixture",action:"updated",before:"a",after:"b",outcome:"succeeded"});
test("missing Core contract fails closed without global audit fallback",async()=>{
 const c=create();c.select("student","A");await c.load();assert.equal(c.snapshot().phase,"error");assert.deepEqual(c.snapshot().events,[]);
});
test("reject whole response for same-ID wrong type or same-type wrong-ID",async()=>{
 for(const event of [e("1","running_class","A"),e("1","student","B")]){
  const c=create(async()=>({events:[e(),event],nextCursor:null}));c.select("student","A");await c.load();assert.equal(c.snapshot().phase,"error");assert.deepEqual(c.snapshot().events,[]);
 }
});
test("search and pagination passed to reader; newest first and no duplicate cursor",async()=>{
 const calls=[];const c=create(async q=>{calls.push(q);return q.cursor?{events:[e("2","student","A","2026-10-23T09:00:00Z")],nextCursor:null}:{events:[e()],nextCursor:"cursor-1"};});
 c.select("student","A");await c.load("name");await c.load("name",true);
 assert.deepEqual(calls,[{subject_type:"student",subject_id:"A",query:"name",cursor:null,limit:50},{subject_type:"student",subject_id:"A",query:"name",cursor:"cursor-1",limit:50}]);
 assert.deepEqual(c.snapshot().events.map(x=>x.id),["1","2"]);
 await c.load("new search");assert.equal(calls.at(-1).cursor,null);assert.equal(c.snapshot().events.length,1);
});
test("switch entity or close invalidates delayed results; prior history clears immediately",async()=>{
 let finish;const c=create(()=>new Promise(r=>{finish=r;}));c.select("student","A");const a=c.load();c.select("student","B");assert.deepEqual(c.snapshot().events,[]);finish({events:[e()],nextCursor:null});await a;assert.equal(c.snapshot().phase,"idle");
 const b=c.load();c.clear();finish({events:[e("2","student","B")],nextCursor:null});await b;assert.deepEqual(c.snapshot().events,[]);
});
test("search race cannot display stale prior query",async()=>{
 const resolvers=[];const c=create(()=>new Promise(r=>resolvers.push(r)));c.select("student","A");const a=c.load("old"),b=c.load("new");
 resolvers[1]({events:[e("new")],nextCursor:null});await b;resolvers[0]({events:[e("old")],nextCursor:null});await a;assert.equal(c.snapshot().events[0].id,"new");
});
test("403,409,network and malformed/order responses cannot keep old data or success",async()=>{
 for(const fail of [403,409,"network","order","cursor"]){
  let count=0;const c=create(async()=>{if(!count++)return {events:[e()],nextCursor:"c"};if(fail==="order")return {events:[e("2","student","A","2026-10-25T09:00:00Z")],nextCursor:null};if(fail==="cursor")return {events:[],nextCursor:"c"};throw Object.assign(Error("unsafe raw payload"),{status:fail});});
  c.select("student","A");await c.load();await c.load("",true);assert.equal(c.snapshot().phase,"error");assert.deepEqual(c.snapshot().events,[]);assert.doesNotMatch(c.snapshot().error,/unsafe/);
 }
});
