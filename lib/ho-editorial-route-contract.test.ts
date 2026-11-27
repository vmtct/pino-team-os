import {decideHostBoundary} from "./host-boundary";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HO_EDITORIAL_API as root,editorialRoute,editorialHostDecision} from "./ho-editorial-route-contract";
const host="ho.staging.pinohouse.art",id="019d2170-0000-7000-8000-000000000001";
test("PAP-2404 exact HO Editorial paths and methods",()=>{
 const paths=[[root,"GET"],[root+"/"+id,"GET"],[root+"/"+id+"/history","GET"],[root+"/decision","POST"]] as const;
 for(const [p,m] of paths){
  assert.equal(editorialHostDecision(host,host,p,m),"next");
  for(const denied of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","unknown.invalid"])assert.equal(editorialHostDecision(denied,host,p,m),"not_found");
  for(const verb of ["GET","POST","PATCH","DELETE","PUT","HEAD","OPTIONS"].filter(v=>v!==m))assert.equal(editorialHostDecision(host,host,p,verb),"not_found");
 }
 for(const p of [root+"/",root+"/bad",root+"/"+id+"/unknown",root.toUpperCase(),root.replace("/ho/","/bo/"),root.replace("/ho/","/tos/")]){
  assert.equal(editorialRoute(p),null);assert.equal(editorialHostDecision(host,host,p,"GET"),"not_found");
 }
 assert.equal(editorialHostDecision(host,host,"/api/ho/learning/missions","GET"),null);
});
test("private route delegates only GET and POST",()=>{
 const route=readFileSync("app/api/ho/learning/piner-posts/editorial/[[...path]]/route.ts","utf8");
 assert.match(route,/return handleHoEditorialRequest\(request,env\)/);
 assert.deepEqual([...route.matchAll(/export const ([A-Z]+)=handle/g)].map(m=>m[1]),["GET","POST"]);
});

test("PAP-2404 actual shared host gate uses exact Editorial contract before fallback",()=>{
 const allowed=[[root,"GET"],[root+"/"+id,"GET"],[root+"/"+id+"/history","GET"],[root+"/decision","POST"]] as const;
 for(const [p,m] of allowed){
  assert.deepEqual(decideHostBoundary(host,p,m),{action:"next"});
  for(const h of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","unknown.invalid","team.pinohouse.art","bo.pinohouse.art"])assert.deepEqual(decideHostBoundary(h,p,m),{action:"not_found"});
  for(const v of ["GET","POST","PATCH","DELETE","HEAD","OPTIONS"].filter(v=>v!==m))assert.deepEqual(decideHostBoundary(host,p,v),{action:"not_found"});
 }
 for(const p of [root+"/",root+"/bad",root.toUpperCase(),root+"/"+id+"/unknown",root.replace("/ho/","/bo/"),root.replace("/ho/","/tos/")])assert.deepEqual(decideHostBoundary(host,p,"GET"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(host,"/api/ho/learning/missions","GET"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(host,"/api/ho/learning/missions","POST"),{action:"next"});
});
