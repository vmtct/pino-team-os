import test from "node:test";
import assert from "node:assert/strict";
import {bindNativePortfolioLifecycle} from "../src/portfolio-native-lifecycle.mjs";
const id=n=>"018f0000-0000-7000-8000-"+String(n).padStart(12,"0"),a=id(1),b=id(2);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(space="house",tab="home"){
 let selected=a;const chrome=new EventTarget(),slot=new EventTarget(),win=new EventTarget(),requests=[],calls=[];
 chrome.dataset={memberSession:"true"};
 chrome.querySelector=()=>({dataset:{pinerSpace:space,unifiedTab:tab}});
 chrome.querySelectorAll=()=>[a,b].map(id=>({dataset:{studentId:id},getAttribute:()=>String(id===selected)}));
 slot.innerHTML="";
 const model=key=>({space,profileKey:key,state:"ready",posts:[{space,key:"post",label:"PINO",caption:key===a?"first learner":"second learner",date:"27/11/2026",media:[{src:"/private/test-image"}]}]});
 const args={chrome,slot,window:win,space,tab,read:scope=>new Promise(resolve=>requests.push({...scope,resolve})),bindInteractions:()=>{calls.push("bind");return()=>calls.push("dispose");}};
 return {chrome,slot,win,requests,calls,model,args,select(id){selected=id;chrome.dispatchEvent(new Event("piner:select-student"));}};
}
test("PAP-2432 native events use restored selection, clear old UI, preserve renderer and reject stale result",async()=>{
 const f=harness();bindNativePortfolioLifecycle(f.args);await tick();assert.equal(f.requests[0].studentId,a);
 f.requests[0].resolve(f.model(a));await tick();assert.match(f.slot.innerHTML,/first learner/);
 f.select(b);await tick();assert.doesNotMatch(f.slot.innerHTML,/first learner/);assert.equal(f.requests[1].studentId,b);assert.deepEqual(f.calls,["bind","dispose"]);
 f.select(a);await tick();assert.equal(f.requests[1].signal.aborted,true);
 f.requests[2].resolve(f.model(a));await tick();f.requests[1].resolve(f.model(b));await tick();
 assert.match(f.slot.innerHTML,/first learner/);assert.doesNotMatch(f.slot.innerHTML,/second learner/);
});
test("PAP-2432 native retry and sign-out clear content and fence delayed data",async()=>{
 const f=harness();bindNativePortfolioLifecycle(f.args);await tick();
 f.requests[0].resolve({...f.model(a),state:"error"});await tick();assert.match(f.slot.innerHTML,/data-portfolio-retry/);
 f.chrome.dispatchEvent(new Event("piner:portfolio-retry"));assert.equal(f.requests[1].studentId,a);
 f.chrome.dispatchEvent(new Event("piner:sign-out"));assert.equal(f.requests[1].signal.aborted,true);
 f.requests[1].resolve(f.model(a));await tick();assert.doesNotMatch(f.slot.innerHTML,/first learner/);
});
test("PAP-2432 MyTime self, pagehide and non-admitted shell",async()=>{
 const f=harness("mytime","grid");bindNativePortfolioLifecycle(f.args);assert.equal(f.requests[0].studentId,null);
 f.win.dispatchEvent(new Event("pagehide"));f.requests[0].resolve(f.model(null));await tick();assert.doesNotMatch(f.slot.innerHTML,/second learner/);
 const g=harness();g.chrome.dataset.memberSession="false";assert.equal(bindNativePortfolioLifecycle(g.args),null);assert.equal(g.requests.length,0);
});
