/** PAP-1874 / Epic PAP-1665 PLT-ATTR FSG4: read-only History BFF and native Full Detail. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {hoAttributeDefinitions} from "./ho-attribute-definitions-facade";

const root="/api/ho/custom-attributes/definitions";
const id="019d1000-0001-7000-8000-000000000001";
const history=root+"/"+id+"/history";
const host="ho.staging.pinohouse.art";
const env={APP_ENV:"staging"} as Parameters<typeof hoAttributeDefinitions>[1];
const make=(url:string,method="GET",hostname=host)=>
 new Request("https://"+hostname+url,{method,headers:{host:hostname}});

test("PAP-1874: host boundary allows only exact Staging Founder GET history",()=>{
 assert.deepEqual(decideHostBoundary(host,history,"GET"),{action:"next"});
 for(const method of ["POST","PUT","PATCH","DELETE","HEAD"])
  assert.deepEqual(decideHostBoundary(host,history,method),{action:"not_found"});
 for(const domain of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","pinohouse.art"])
  assert.deepEqual(decideHostBoundary(domain,history,"GET"),{action:"not_found"});
 for(const suffix of ["/extra","/","-other"]){
  if(suffix==="/")continue; // Existing host-boundary canonical trailing slash policy.
  assert.deepEqual(decideHostBoundary(host,history+suffix,"GET"),{action:"not_found"});
 }
 assert.deepEqual(decideHostBoundary(host,root+"/bad/history","GET"),{action:"not_found"});
});
test("PAP-1874: strict pagination rejected before identity and Core transport",async()=>{
 for(const query of ["?limit=1&limit=2","?offset=-1","?limit=0","?limit=51","?offset=10001","?foo=bar","?limit=%31%30%20"])
  assert.equal((await hoAttributeDefinitions(make(history+query),env)).status,400,query);
 assert.equal((await hoAttributeDefinitions(make(history,"POST"),env)).status,404);
 assert.equal((await hoAttributeDefinitions(make(history,"GET","ho.pinohouse.art"),env)).status,404);
});
test("PAP-1874: Full Detail reuses PINO DSA 14-field native shell and has zero edit handlers",()=>{
 const file=readFileSync("app/ho/system/custom-attributes/HoAttributeFullDetail.tsx","utf8");
 const page=readFileSync("app/ho/system/custom-attributes/page.tsx","utf8");
 assert.match(file,/<DetailFrame/);assert.match(file,/<PropertySections/);
 assert.match(file,/variant="detail"/);assert.match(file,/Tổng quan/);assert.match(file,/Lịch sử/);
 assert.match(file,/propertyKeys\.slice\(0,10\)/);assert.match(file,/propertyKeys\.slice\(10\)/);
 assert.doesNotMatch(file,/onEdit=|BoTypedEditor|onSave=|method:"PATCH"|method:"PUT"/);
 assert.match(page,/onDetail=\{\(\)=>setOpen\("detail"\)\}/);
 assert.doesNotMatch(page,/hideDetailAction/);
});
