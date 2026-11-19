import {test} from "node:test";
import assert from "node:assert/strict";
import {browserTddNavigation} from "./workspace-adapters/navigation";
import {workshopBinding} from "../app/components/mytime-workshop/schema";
const center="019d2161-0000-7000-8000-000000000001",id="019d2161-0000-7000-8000-000000000002";
test("PAP-2164 actual shared navigation adapter retains selected Center, drawer/detail/history and back",()=>{
 const initial="https://bo.staging.pinohouse.art/bo/mytime-workshops?centerId="+center;
 let url=new URL(initial),index=0;
 const stack:{url:string;state:unknown}[]=[{url:initial,state:null}];
 const win=new EventTarget();
 const descriptors=new Map<string,PropertyDescriptor|undefined>();
 const mock={location:{get href(){return url.href},get hostname(){return url.hostname},get host(){return url.host},get origin(){return url.origin},get pathname(){return url.pathname},get search(){return url.search}},window:win,history:{
  get state(){return stack[index]?.state},
  pushState(state:unknown,_title:string,path:string){url=new URL(path,url);stack.splice(index+1);stack.push({url:url.href,state});index++;},
  replaceState(state:unknown,_title:string,path:string){url=new URL(path,url);stack[index]={url:url.href,state};}
 }};
 try{
  for(const [key,value] of Object.entries(mock)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value});}
  const {query}=workshopBinding("BO",{centers:[],missions:[],specialties:[],staff:[]},{read:"view",create:"create",edit:"edit",history:"view"});
  const nav=browserTddNavigation("BO","mytime-workshops",query);
  let calls=0;const off=nav.subscribe(()=>{calls++;});
  assert.equal(nav.read().kind,"table");
  nav.change({kind:"drawer",recordId:id,tab:"overview",query});
  assert.equal(nav.read().recordId,id);assert.equal(nav.read().kind,"drawer");
  nav.change({kind:"detail",recordId:id,tab:"overview",query});
  nav.change({kind:"detail",recordId:id,tab:"history",query},true);
  assert.equal(nav.read().kind,"detail");assert.equal(nav.read().tab,"history");
  assert.equal(url.searchParams.get("centerId"),center);
  index--;url=new URL(stack[index]!.url);win.dispatchEvent(new Event("popstate"));
  assert.equal(nav.read().kind,"drawer");assert.equal(nav.read().tab,"overview");
  nav.change({kind:"table",tab:"overview",query});assert.equal(url.searchParams.get("record"),null);
  off();assert.equal(calls,5);
  url=new URL(initial+"&record="+id);stack[index]={url:url.href,state:null};
  assert.equal(browserTddNavigation("BO","mytime-workshops",query).read().recordId,id);
  url=new URL(initial.replace("bo.staging","bo"));
  assert.throws(()=>browserTddNavigation("BO","mytime-workshops",query),/route mismatch/);
 }finally{for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});