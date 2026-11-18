import test from "node:test";
import assert from "node:assert/strict";
import {decideHostBoundary} from "./host-boundary";
import {readFileSync} from "node:fs";
const bo="bo.staging.pinohouse.art",id="01a194f0-9bd0-7896-89a0-677a620e3ecd";
const def="01a1e1a0-0000-7000-8000-000000000001";
const roots=["/api/bo/students/"+id+"/custom-attributes","/api/bo/identity/parents/"+id+"/custom-attributes"];
test("PAP-1671 exact BO Staging only GET collection and PATCH definition",()=>{
 for(const root of roots)for(const path of [root,root+"/"+def]){
  for(const method of ["GET","PATCH","POST","PUT","DELETE","HEAD","OPTIONS"]){
   const allowed=path===root?method==="GET":method==="PATCH";
   assert.deepEqual(decideHostBoundary(bo,path,method),{action:allowed?"next":"not_found"},method+" "+path);
  }
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","join.pinohouse.art","bo.staging.pinohouse.art.evil.test"])
   for(const method of ["GET","PATCH"])assert.deepEqual(decideHostBoundary(host,path,method),{action:"not_found"},host);
 }
});
test("PAP-1671 malformed descendants and noncanonical UUID never fall through",()=>{
 for(const root of roots)for(const path of [root+"/",root+"/invalid",root+"/"+def+"/extra",root.replace(id,"bad"),root.replace(id,id.toUpperCase()),root.replace(id,id.replace("-7896-","-6896-")),root+"/%2F"+def,root.replace("/custom-attributes","/CUSTOM-ATTRIBUTES")]){
  for(const method of ["GET","PATCH"])assert.deepEqual(decideHostBoundary(bo,path,method),{action:"not_found"},path);
 }
});
test("PAP-1671 catchall routes exact matching requests before generic handlers",()=>{
 const source=readFileSync("app/api/bo/[...path]/route.ts","utf8");
 for(const method of ["GET","PATCH","POST","PUT","DELETE"]){
  const section=source.split("export async function "+method+"(")[1]?.split("export async function ")[0];
  assert.ok(section);
  const admission=section.indexOf("if (isBoCustomAttributeValuePath(joined)) return handleBoCustomAttributeValueRequest(request,env,joined);");
  assert.ok(admission>=0&&admission<section.indexOf("return handleBo",admission+100),method);
 }
});