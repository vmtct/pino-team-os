import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,V18bCoreError,V18B_WRITE_ADMITTED} from "./tos-classroom-v18b-api";

const input={
 centerId:"center-a",runningClassId:"class-a",studentId:"student-a",
 localDate:"2026-11-02",teachingContextKey:"class-a:2026-11-02",
};
const scoped={
 ...input,pathProgramId:"path-a",hasMore:false,
 items:[{missionId:"mission-1",code:"ART-01",name:"Đường nét",level:1,assignmentId:null}],
};
const ok=(value:unknown)=>new Response(JSON.stringify({data:value}),{
 status:200,headers:{"content-type":"application/json"},
});

test("PAP-945 eligible Missions use the authentic scoped Staff endpoint, never global catalog",async()=>{
 const requests:Array<{url:string;method:string;cache:RequestCache|undefined}>=[];
 const api=createV18bApiTransport(false,(async(url:RequestInfo|URL,opts:RequestInit={})=>{
  requests.push({url:String(url),method:opts.method??"GET",cache:opts.cache});
  return ok(scoped);
 }) as typeof fetch);
 const result=await api.eligibleMissions(input);
 assert.deepEqual(result,scoped);
 assert.deepEqual(requests,[{
  url:"/api/tos-learning/learning/missions/eligible?centerId=center-a&runningClassId=class-a&studentId=student-a&localDate=2026-11-02&teachingContextKey=class-a%3A2026-11-02&limit=50&offset=0",
  method:"GET",cache:"no-store",
 }]);
 assert.equal(V18B_WRITE_ADMITTED,false);
});
test("PAP-945 preserves empty authorized catalog and pagination without fabrication",async()=>{
 const api=createV18bApiTransport(false,(async()=>ok({...scoped,items:[],hasMore:true})) as typeof fetch);
 const result=await api.eligibleMissions({...input,limit:10,offset:10});
 assert.deepEqual(result.items,[]);
 assert.equal(result.hasMore,true);
});
test("PAP-945 forged occurrence or malformed scope is rejected before fetch",()=>{
 let requests=0;
 const api=createV18bApiTransport(false,(async()=>{requests++;return ok(scoped)}) as typeof fetch);
 const bad=[
  {...input,centerId:""},
  {...input,studentId:""},
  {...input,localDate:"2026-02-30",teachingContextKey:"class-a:2026-02-30"},
  {...input,teachingContextKey:"class-b:2026-11-02"},
  {...input,limit:0},{...input,limit:101},{...input,offset:-1},
  {...input,offset:10001},
 ];
 for(const item of bad)assert.throws(()=>api.eligibleMissions(item),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===400);
 assert.equal(requests,0);
});
test("PAP-945 Staff 403 and Core outage are visible errors, not fallback catalog",async()=>{
 for(const status of [403,503]){
  const api=createV18bApiTransport(false,(async()=>new Response(JSON.stringify({
   error:{code:status===403?"ACCESS_PERMISSION_DENIED":"CORE_UNAVAILABLE",message:"Core error"},
  }),{status})) as typeof fetch);
  await assert.rejects(api.eligibleMissions(input),
   (e:unknown)=>e instanceof V18bCoreError&&e.status===status);
 }
});
test("PAP-945 rejects wrong scope, malformed Mission rows and stale readback",async()=>{
 const invalid=[
  {...scoped,studentId:"another-student"},
  {...scoped,centerId:"another-center"},
  {...scoped,teachingContextKey:"class-a:2026-11-03"},
  {...scoped,items:[{missionId:"",code:"ART",name:"No ID",level:1,assignmentId:null}]},
  {...scoped,items:[{missionId:"mission-1",code:"ART",name:"A",level:1,assignmentId:null},
                    {missionId:"mission-1",code:"ART",name:"A",level:1,assignmentId:null}]},
  {...scoped,items:null},
  {...scoped,hasMore:"false"},
 ];
 for(const row of invalid){
  const api=createV18bApiTransport(false,(async()=>ok(row)) as typeof fetch);
  await assert.rejects(api.eligibleMissions(input),
   (e:unknown)=>e instanceof V18bCoreError&&e.code==="MISSION_ELIGIBILITY_READBACK_MISMATCH");
 }
});
