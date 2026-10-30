import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {safeHoReturnTo} from "./ho-routes";
import {validateModule} from "./workspace-schema";
import {passDefinition,passProvider,passQuery,passSchema,loadHoWalkinInventory} from "../app/ho/open-studio/walkin/schema";
import {hoModules,hoRoutes} from "./ho-system";

const id="00000000-0000-4000-8000-000000000021";
const batch="00000000-0000-4000-8000-000000000022";
const inventory="/api/ho/open-studio/walkin/inventory";
const create="/api/ho/open-studio/walkin/batches";
const host="ho.staging.pinohouse.art";
const record={id,code:"PINO-OS-00AABBCCDD",batch_id:batch,status:"AVAILABLE",
 path_code:null,parent_user_id:null,center_id:null};

test("PAP-1166: exact HO staging host and method allowlist",()=>{
 for(const [path,method] of [["/ho/open-studio/walkin","GET"],[inventory,"GET"],[create,"POST"]])
  assert.deepEqual(decideHostBoundary(host,path,method),{action:"next"});
 for(const method of ["HEAD","POST","PUT","PATCH","DELETE"])
  assert.deepEqual(decideHostBoundary(host,inventory,method),{action:"not_found"});
 for(const method of ["GET","HEAD","PUT","PATCH","DELETE"])
  assert.deepEqual(decideHostBoundary(host,create,method),{action:"not_found"});
 for(const wrongHost of ["ho.pinohouse.art","bo.staging.pinohouse.art","tos.staging.pinohouse.art","localhost"])
  for(const path of [inventory,create,"/ho/open-studio/walkin"])
   assert.deepEqual(decideHostBoundary(wrongHost,path,path===create?"POST":"GET"),{action:"not_found"});
 assert.equal(safeHoReturnTo("/ho/open-studio/walkin"),"/ho/open-studio/walkin");
 assert.equal(safeHoReturnTo("/ho/open-studio/walkin?record="+id),"/ho/open-studio/walkin?record="+id);
});

test("PAP-1166: HO inventory strict actual Core shape; no fake successes",async()=>{
 const signal=new AbortController().signal;
 const response=(data:unknown,status=200)=>async()=>Response.json(data,{status});
 const good=await loadHoWalkinInventory(response({data:[record]}) as typeof fetch,signal);
 assert.deepEqual(good,[record]);
 for(const invalid of [
  {data:{}},{data:[{...record,batch_id:"wrong"}]},{data:[{...record,code:"FAKE"}]},
  {data:[{...record,status:"VOID"}]},{data:[{...record,center_id:"cross-center"}]},
  {data:[{...record,path_code:"PRO"}]},{data:[{...record,parent_user_id:"fake"}]},
 ])await assert.rejects(loadHoWalkinInventory(response(invalid) as typeof fetch,signal));
 await assert.rejects(loadHoWalkinInventory(response({error:{code:"ACCESS_DENIED"}},403) as typeof fetch,signal));
});

test("PAP-1166: canonical TDD registration and HO sole nav target",()=>{
 validateModule(passSchema);
 assert.equal(passSchema.surface,"HO");
 assert.equal(passDefinition.key,"walkinPasses");
 assert.equal(passSchema.capabilities.read,"open_studio.walkin_pass.manage");
 assert.equal(passSchema.detail.history.kind,"unavailable");
 assert.equal(passProvider.pagination,"local-ui");
 assert.deepEqual(passQuery.visible,["code","status","path","parent","center"]);
 assert.equal(hoRoutes.walkinPasses,"/ho/open-studio/walkin");
 assert.equal(hoModules.walkinPasses.group,"Open Studio");
 const controller=readFileSync("app/ho/open-studio/walkin/HoWalkinPassTdd.tsx","utf8");
 const schema=readFileSync("app/ho/open-studio/walkin/schema.ts","utf8");
 const create=readFileSync("app/ho/open-studio/walkin/HoWalkinBatchCreate.tsx","utf8");
 assert.match(controller,/createHoTddAdapter/);
 assert.match(controller,/SurfaceWorkspace/);
 assert.match(controller,/@pino\/design-system\/components\.css/);
 assert.match(schema,/loadHoWalkinInventory\(fetch,signal\)/);
 assert.doesNotMatch(schema,/mock|fixturePass/i);
 assert.match(create,/api\/ho\/open-studio\/walkin\/batches/);
 assert.match(create,/idempotency-key/);
 assert.match(create,/api\/ho\/open-studio\/walkin\/inventory/);
 assert.match(create,/setNeedsReadback\(true\)/);
 assert.doesNotMatch(create,/status:\s*["']CONSUMED/);
});
