import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
const base="/api/bo/acquisition/households",id="01a03c6e-cc58-7d81-ac8e-123456789abc",host="bo.staging.pinohouse.art";
test("PAP-2288 exact BO Staging Lead household ingress through actual host fence",()=>{
 const allowed=[["","POST"],["/search","POST"],["/recovery","POST"],["/manual-centers","GET"],["/manual-intake","POST"],["/manual-intake/recovery","POST"],...["contacted","verify-contact","close","recovery"].map(a=>["/"+id+"/intents/"+id+"/"+a,"POST"]),["/"+id,"GET"],["/"+id+"/history","GET"],...["contact","members","primary","relationships","archive"].map(a=>["/"+id+"/"+a,"POST"]),...["update","retire"].map(a=>["/"+id+"/members/"+id+"/"+a,"POST"]),...["update","retire","confirm"].map(a=>["/"+id+"/relationships/"+id+"/"+a,"POST"])];
 for(const [suffix,method] of allowed){
  assert.deepEqual(decideHostBoundary(host,base+suffix,method),{action:"next"});
  for(const wrongHost of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","localhost","unknown.workers.dev"])assert.deepEqual(decideHostBoundary(wrongHost,base+suffix,method),{action:"not_found"});
  for(const wrongMethod of ["GET","POST","PUT","DELETE","PATCH","HEAD"].filter(v=>v!==method))assert.deepEqual(decideHostBoundary(host,base+suffix,wrongMethod),{action:"not_found"});
 }
 for(const suffix of ["/"+id+"/members/"+id+"/confirm","/not-id","/search/extra","/"+id+"/history/","/"+id+"/archive/extra"])assert.deepEqual(decideHostBoundary(host,base+suffix,"POST"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(host,base.toUpperCase()+"/search","POST"),{action:"not_found"});
 for(const surface of ["ho","tos"])assert.deepEqual(decideHostBoundary(surface+".staging.pinohouse.art","/api/"+surface+"/acquisition/households/search","POST"),{action:"not_found"});
});
test("PAP-2288 mounted route exports only GET and POST and uses canonical handler",()=>{
 const source=readFileSync("app/api/bo/acquisition/households/[[...path]]/route.ts","utf8");
 assert.match(source,/return handleLeadHousehold\(request,env\)/);
 assert.match(source,/export const GET=dispatch/);
 assert.match(source,/export const POST=dispatch/);
 assert.doesNotMatch(source,/export const (PUT|DELETE|PATCH|HEAD)/);
});
