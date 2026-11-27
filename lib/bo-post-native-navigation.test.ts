import {test} from "node:test";
import assert from "node:assert/strict";
import {parseNativePostQuery} from "../app/bo/piner-posts/native-post-query";
import {postNativeNavigation} from "../app/bo/piner-posts/native-post-navigation";
import {draftQuery} from "../app/bo/piner-posts/native-draft-binding";
const C="01900000-0000-7000-8000-000000000001",P="01900000-0000-7000-8000-000000000002",path="/bo/piner-posts",origin="https://bo.staging.pinohouse.art";
test("PAP-2386 exact canonical real query, no mock or client mode selector",()=>{
 for(const [q,canonical] of [["",""],["centerId="+C,"centerId="+C],["record="+P,"record="+P],["tab=media&record="+P+"&centerId="+C+"&utm_source=qa","centerId="+C+"&record="+P+"&tab=media"]] as const)assert.equal(parseNativePostQuery(new URLSearchParams(q))?.canonical,canonical);
 for(const q of ["record=POST-MOCK-001","m1Preview=1","m1Preview=1&record="+P,"record=","record="+P+"&record="+P,"record="+P+"&tab=invalid","tab=media","centerId=bad","centerId="+C+"&centerId="+C,"record=01900000-0000-4000-8000-000000000002","returnTo=//evil.example"])assert.equal(parseNativePostQuery(new URLSearchParams(q)),null,q);
});
test("PAP-2386 native detail URL survives fresh navigation, table return clears record and tab",()=>{
 const previous=new Map(["location","history","window"].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let url=new URL(origin+path+"?centerId="+C+"&record="+P+"&tab=media"),state:unknown=null;
 const eventTarget=new EventTarget();
 const history={get state(){return state;},pushState(s:unknown,_unused:string,href:string){state=s;url=new URL(href,origin);},replaceState(s:unknown,_unused:string,href:string){state=s;url=new URL(href,origin);}};
 try{
  Object.defineProperty(globalThis,"location",{configurable:true,get:()=>url});
  Object.defineProperty(globalThis,"history",{configurable:true,value:history});
  Object.defineProperty(globalThis,"window",{configurable:true,value:eventTarget});
  const nav=postNativeNavigation();assert.equal(nav.read().kind,"detail");assert.equal(nav.read().tab,"media");
  let calls=0;const off=nav.subscribe(()=>calls++);
  nav.change({kind:"detail",recordId:P,tab:"history",query:draftQuery},true);
  assert.equal(url.searchParams.get("tab"),"history");assert.equal(postNativeNavigation().read().tab,"history");
  nav.change({kind:"drawer",recordId:P,tab:"overview",query:draftQuery});
  assert.equal(postNativeNavigation().read().kind,"drawer");assert.equal(url.searchParams.has("tab"),false);
  nav.change({kind:"table",tab:"overview",query:draftQuery});
  assert.equal(url.href,origin+path+"?centerId="+C);assert.equal(nav.read().kind,"table");assert.equal(calls,3);off();
  assert.throws(()=>nav.change({kind:"detail",recordId:"POST-MOCK-001",tab:"media",query:draftQuery}));
 }finally{for(const [k,v] of previous)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}
});
