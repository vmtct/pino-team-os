import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {safeHoReturnTo,HO_PAGE_PATHS} from "./ho-routes";
import {validateModule} from "./workspace-schema";
import {passSchema,passDefinition,passProvider,passQuery,loadHoWalkinInventory} from "../app/ho/open-studio/walkin/schema";

const HO="ho.staging.pinohouse.art";
const PASS="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const BATCH="01a0b29a-3acd-7a18-a0f2-cf6016548ab6";
const canonical={id:PASS,code:"PINO-OS-0123456789ABCDEF0123",batch_id:BATCH,status:"AVAILABLE",path_code:null,parent_user_id:null,center_id:null};
const fetchStub=(body:unknown,status=200)=>(
 async()=>Response.json(body,{status})
) as typeof fetch;

test("HO Pass uses one registered canonical TDD and existing HO shell",()=>{
 validateModule(passSchema);
 assert.equal(passSchema.surface,"HO");
 assert.equal(passSchema.key,"walkinPasses");
 assert.equal(passDefinition.detail.history.kind,"unavailable");
 assert.equal(passDefinition.capabilities.read,"open_studio.walkin_pass.manage");
 assert.equal(passQuery.pageSize,15);
 assert.equal(HO_PAGE_PATHS.walkinPasses,"/ho/open-studio/walkin");
 assert.equal(safeHoReturnTo("/ho/open-studio/walkin"),"/ho/open-studio/walkin");
 assert.deepEqual(decideHostBoundary(HO,"/ho/open-studio/walkin","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art","/ho/open-studio/walkin","GET"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary("ho.pinohouse.art","/ho/open-studio/walkin","GET"),{action:"not_found"});
 const page=readFileSync("app/ho/open-studio/walkin/page.tsx","utf8");
 const ui=readFileSync("app/ho/open-studio/walkin/HoWalkinPassTdd.tsx","utf8");
 const source=readFileSync("lib/workspace-adapters/session.ts","utf8");
 assert.match(page,/HoWalkinPassTdd/);
 assert.match(ui,/createHoTddAdapter/);
 assert.match(ui,/SurfaceWorkspace/);
 assert.match(ui,/HoWorkspace/);
 assert.match(ui,/open_studio\.walkin_pass\.manage/);
 assert.match(source,/admittedHoPassInventory = surface === "HO" && method === "GET" && url\.pathname === "\/api\/ho\/open-studio\/walkin\/inventory"/);
 assert.match(source,/surface === "HO" && method !== "GET"/);
});

test("HO host BFF is exact GET/POST and denies other surfaces and verbs",()=>{
 for(const [path,method] of [
  ["/api/ho/open-studio/walkin/inventory","GET"],
  ["/api/ho/open-studio/walkin/batches","POST"],
  ["/api/ho/open-studio/walkin/revoke","POST"],
 ])assert.deepEqual(decideHostBoundary(HO,path,method),{action:"next"});
 for(const [path,method] of [
  ["/api/ho/open-studio/walkin/inventory","POST"],
  ["/api/ho/open-studio/walkin/batches","GET"],
  ["/api/ho/open-studio/walkin/revoke","GET"],
  ["/api/ho/open-studio/walkin/assign","POST"],
  ["/api/ho/open-studio/walkin/history","GET"],
 ])assert.deepEqual(decideHostBoundary(HO,path,method),{action:"not_found"});
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"]){
  assert.deepEqual(decideHostBoundary(host,"/api/ho/open-studio/walkin/batches","POST"),{action:"not_found"});
 }
});

test("Pass provider returns only real and validated Core rows; never invented inventory",async()=>{
 const controller=new AbortController();
 const get=fetchStub({data:[canonical]});
 const passes=await loadHoWalkinInventory(get,controller.signal);
 assert.deepEqual(passes,[canonical]);
 const listing=await passProvider.list(passQuery,{surface:"HO"},get,controller.signal);
 assert.equal(listing.total,1);
 assert.equal(listing.records[0]?.row.code,canonical.code);
 assert.equal(listing.records[0]?.row.status,"AVAILABLE");
 assert.equal(listing.records[0]?.row.path,"—");
 const detail=await passProvider.detail(PASS,{surface:"HO"},get,controller.signal);
 assert.equal(detail?.row.id,PASS);
 assert.equal(await passProvider.detail(BATCH,{surface:"HO"},get,controller.signal),null);
 await assert.rejects(passProvider.list(passQuery,{surface:"BO",centerId:PASS},get,controller.signal),/HO only/);
 for(const bad of [
  {data:[{...canonical,id:"wrong"}]},{data:[{...canonical,status:"PAID"}]},
  {data:[{...canonical,path_code:"AR"}]},{data:[{...canonical,code:"PINO-OS-ERROR"}]},
  {data:[{...canonical,parent_user_id:"not-uuid"}]},{data:{passes:[canonical]}},
 ]){
  await assert.rejects(loadHoWalkinInventory(fetchStub(bad),controller.signal));
 }
 await assert.rejects(loadHoWalkinInventory(fetchStub({error:"unauthorized"},403),controller.signal),/Không thể tải/);
});

test("HO command strictly uses server BFF and authoritative readback; never generates pass codes",()=>{
 const code=readFileSync("app/ho/open-studio/walkin/HoWalkinBatchCreate.tsx","utf8");
 assert.match(code,/\/api\/ho\/open-studio\/walkin\/batches/);
 assert.match(code,/\/api\/ho\/open-studio\/walkin\/inventory\?limit=100/);
 assert.match(code,/batch_id===receipt\.id/);
 assert.match(code,/crypto\.randomUUID\(\)/);
 assert.match(code,/setNeedsReadback\(true\)/);
 assert.doesNotMatch(code,/open_studio_passes/);
 assert.doesNotMatch(code,/document\.cookie/);
});
