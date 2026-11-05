import test from "node:test";
import assert from "node:assert/strict";
import {BO_TARGET_ROUTES, BO_LEGACY_QUERY_MODULES, buildBoTargetUrl, parseBoTargetUrl} from "./bo-url-contract";
import {decideHostBoundary} from "./host-boundary";
import {browserTddNavigation} from "./workspace-adapters/navigation";
import {tvQuery} from "../app/bo/tvs/schema";

const staging="bo.staging.pinohouse.art";
function at(url:string, fn:()=>void) {
 const previous=Object.getOwnPropertyDescriptor(globalThis,"location");
 const target=new URL(url);
 Object.defineProperty(globalThis,"location",{configurable:true,value:{hostname:target.hostname,host:target.host,origin:target.origin,pathname:target.pathname,search:target.search,href:target.href}});
 try { fn(); } finally {if(previous)Object.defineProperty(globalThis,"location",previous);else Reflect.deleteProperty(globalThis,"location");}
}

test("PAP-1266 TVs has exact canonical TDD URL + business tab; never a legacy alias",()=>{
 assert.deepEqual(BO_TARGET_ROUTES.find(x=>x.key==="tvs"),{key:"tvs",path:"/bo/tvs",tabs:["overview","space","history"]});
 assert.equal(BO_LEGACY_QUERY_MODULES.includes("tvs" as never),false);
 assert.equal(buildBoTargetUrl({moduleKey:"tvs",surface:"table"}),"/bo/tvs");
 assert.deepEqual(parseBoTargetUrl("/bo/tvs"),{moduleKey:"tvs",surface:"table"});
 assert.equal(buildBoTargetUrl({moduleKey:"tvs",surface:"detail",recordId:"tv_123",tab:"space"}),"/bo/tvs/tv_123?tab=space");
 assert.equal(parseBoTargetUrl("/bo/tvs/tv_123?tab=unauthorized"),null);
 assert.equal(parseBoTargetUrl("/ho/tvs"),null);
});
test("PAP-1266 staging Center TVs navigation is admitted but wrong pathname and cross-surface host fail closed",()=>{
 assert.deepEqual(decideHostBoundary(staging,"/bo/tvs","GET"),{action:"next"});
 at("https://"+staging+"/bo/tvs",()=>assert.doesNotThrow(()=>browserTddNavigation("BO","tvs",tvQuery)));
 at("https://"+staging+"/bo/students",()=>assert.throws(()=>browserTddNavigation("BO","tvs",tvQuery),/route mismatch/));
 at("https://ho.staging.pinohouse.art/bo/tvs",()=>assert.throws(()=>browserTddNavigation("BO","tvs",tvQuery),/route mismatch/));
});
