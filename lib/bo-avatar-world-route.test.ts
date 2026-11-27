import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
const id="01a194f0-9bd0-7896-89a0-000000000001";
const root="/api/bo/pinoria/avatars/"+id,world=root+"/world",commands=world+"/commands";
const bo="bo.staging.pinohouse.art";
test("PAP-2153 exact BO Staging World method/path and legacy nickname preserved",()=>{
 for(const [path,method] of [[world,"GET"],[commands,"POST"],[root,"PATCH"],["/api/bo/pinoria/avatars/starter-sets","GET"]])assert.deepEqual(decideHostBoundary(bo,path,method),{action:"next"});
 for(const path of [world,commands])for(const method of ["GET","POST","PATCH","PUT","DELETE","HEAD","OPTIONS"])if(!(path===world&&method==="GET")&&!(path===commands&&method==="POST"))assert.deepEqual(decideHostBoundary(bo,path,method),{action:"not_found"});
 for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","evil.example"])for(const [path,method] of [[world,"GET"],[commands,"POST"]])assert.deepEqual(decideHostBoundary(host,path,method),{action:"not_found"});
 for(const wrong of [world+"/",world+"/media",commands+"/extra",world.replace(id,"forged"),world.replace(id,id.toUpperCase())])assert.deepEqual(decideHostBoundary(bo,wrong,"GET"),{action:"not_found"});
});
test("PAP-2153 exact facade dispatch before generic BO handlers",()=>{
 const route=readFileSync(new URL("../app/api/bo/[...path]/route.ts",import.meta.url),"utf8");
 assert.equal((route.match(/if \(isBoAvatarWorldPath\(joined\)\)/g)??[]).length,5);
 assert.ok(route.indexOf("if (isBoAvatarWorldPath(joined))")<route.indexOf("return handleBoOperationalReadRequest"));
 assert.ok(route.indexOf("if (isBoAvatarWorldPath(joined))",route.indexOf("export async function POST"))<route.indexOf("return handleBoWriteRequest"));
});
