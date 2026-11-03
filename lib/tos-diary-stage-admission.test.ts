import test from "node:test";
import assert from "node:assert/strict";
import {isDiaryStagingWriterHost} from "./tos-diary-stage-admission";
import {createV18bApiTransport,V18bCoreError,V18B_WRITE_ADMITTED} from "./tos-classroom-v18b-api";

test("PAP-1400 only canonical TOS Staging with an explicit build flag can construct a writer",()=>{
 assert.equal(V18B_WRITE_ADMITTED,false,"default singleton remains read-only");
 assert.equal(isDiaryStagingWriterHost(false,"tos.staging.pinohouse.art"),false);
 assert.equal(isDiaryStagingWriterHost(true,"tos.staging.pinohouse.art"),true);
 for(const host of ["tos.pinohouse.art","bo.staging.pinohouse.art","ho.staging.pinohouse.art",
  "tos.staging.pinohouse.art.evil.test","pino-team-os-staging.minhtri-van42.workers.dev","localhost"]){
  assert.equal(isDiaryStagingWriterHost(true,host),false,host);
 }
});

test("PAP-1400 no write request hits transport when Staging admission is OFF",async()=>{
 let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({data:{id:"fake"}}));};
 const api=createV18bApiTransport(isDiaryStagingWriterHost(false,"tos.staging.pinohouse.art"),fetcher);
 await assert.rejects(api.register({
  centerId:"center-1",runningClassId:"class-1",studentId:"student-1",
  pathKey:"path-1",teachingContextKey:"class-1:2026-11-03",
 },"pap945:original-key:register"),(e:unknown)=>
  e instanceof V18bCoreError&&e.status===503&&e.code==="CORE_V18B_WRITE_NOT_ADMITTED");
 assert.equal(calls,0);
});
