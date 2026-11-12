/** PAP-1753 · PAP-650 PNR-TV: trusted Staff Center TV list, Viewer remains blocked. */
import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {parseStaffTvRead,readStaffStationTvs} from "./pnr-tv-station-read";

const a="019d1000-0001-7000-8000-000000000001";
const b="019d1000-0001-7000-8000-000000000002";
const data={data:{centerId:a,policies:[
 {id:"tvp1-default",name:"Ambient Welcome",scope:"DEFAULT"},
 {id:"tvp1-center-"+a,name:"Shared Studio TV",scope:"CENTER"},
]}};
const json=(body:unknown,status=200)=>Response.json(body,{status});
test("Core-selected Center metadata maps to FE-only list with GET/no-store and no player config",async()=>{
 const seen:Array<[string,RequestInit|undefined]>=[];
 const transport=(async (input:RequestInfo|URL,init?:RequestInit)=>{
  seen.push([String(input),init]);return json(data);
 }) as typeof fetch;
 const rows=await readStaffStationTvs(a,[a,b],{transport});
 assert.deepEqual(rows,[
  {tvId:"tvp1-default",name:"Ambient Welcome",visibilityScope:"DEFAULT",centerIds:[]},
  {tvId:"tvp1-center-"+a,name:"Shared Studio TV",visibilityScope:"CENTER",centerIds:[a]},
 ]);
 assert.equal(seen.length,1);
 assert.equal(seen[0]?.[0],"/api/tos-learning/pinoria/tv-policies/visible?centerId="+a);
 assert.equal(seen[0]?.[1]?.method,"GET");
 assert.equal(seen[0]?.[1]?.cache,"no-store");
 assert.equal(seen[0]?.[1]?.credentials,"same-origin");
 assert.equal("viewerUrl" in rows[0]!,false);
});
test("unknown/unassigned Center never fetches or shows TV",async()=>{
 let calls=0;
 const transport=(async()=>{calls++;return json(data);}) as typeof fetch;
 for(const id of [b,"Cần Thơ",""]){
  await assert.rejects(readStaffStationTvs(id,[a],{transport}));
 }
 assert.equal(calls,0);
});
test("Core 400/401/403/404/500 and network errors fail closed",async()=>{
 for(const status of [400,401,403,404,500]){
  await assert.rejects(readStaffStationTvs(a,[a],{transport:(async()=>json({error:{code:"DENIED"}},status)) as typeof fetch}));
 }
 await assert.rejects(readStaffStationTvs(a,[a],{transport:(async()=>{throw Error("offline");}) as typeof fetch}));
});
test("strict selected Center, IDs, scope, duplicates, names and no Viewer leakage",()=>{
 const malformed=[
  {...data,data:{...data.data,centerId:b}},
  {...data,data:{...data.data,policies:[{id:"tvp1-default",name:"Oops",scope:"CENTER",viewerUrl:"https://untrusted"}]}},
  {...data,data:{...data.data,policies:[data.data.policies[0],data.data.policies[0]]}},
  {...data,data:{...data.data,policies:[{id:"tvp1-center-"+b,name:"Bad type",scope:"PHYSICAL"}]}},
  {...data,data:{...data.data,policies:[{id:"tvp1-center-"+b,name:" ",scope:"CENTER"}]}},
  {...data,data:{...data.data,policies:"bad"}},
  {data:{centerId:a,policies:[{id:"tvp1-center-invalid",name:"TV",scope:"CENTER"}]}},
  {data:{centerId:a,policies:[{id:"tvp1-default",name:"TV",scope:"DEFAULT",config:{private:true}}]}},
 ];
 for(const value of malformed)assert.throws(()=>parseStaffTvRead(value,a));
});
test("PAP-1753 UI keeps Viewer and commands disabled, exposes loading/error states",()=>{
 const source=readFileSync(new URL("../app/components/tos-vnext/StationLogicalTv.tsx",import.meta.url),"utf8");
 const station=readFileSync(new URL("../app/components/tos-vnext/TosVNextStation.tsx",import.meta.url),"utf8");
 assert.match(source,/readStatus==="loading"/);
 assert.match(source,/readStatus==="error"/);
 assert.match(source,/data-pnr-tv-source/);
 assert.match(source,/disabled title="Viewer cần Core xác thực"/);
 assert.doesNotMatch(source,/href=\{.*tvId/);
 assert.match(station,/readStaffStationTvs\(centerId,authorizedCenterIds,\{signal:controller.signal\}\)/);
 assert.match(station,/controller.abort\(\)/);
});
