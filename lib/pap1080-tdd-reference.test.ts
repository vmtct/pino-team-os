import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atlasDefinition,atlasSchema,atlasProvider,atlasMemoryTransport,atlasQuery,atlasCoverage,atlasRows,atlasScenarios,configureAtlas } from "../app/ho/system/tdd-reference/schema";
import { FIELD_TYPES,TddRegistry,composeTabs,validateModule } from "./workspace-schema";
import { createHoTddAdapter } from "./workspace-adapters";
import { decideHostBoundary } from "./host-boundary";
import { safeHoReturnTo } from "./ho-routes";
const path="/ho/system/tdd-reference",origin="https://ho.staging.pinohouse.art";
const signal=()=>new AbortController().signal;
test("PAP1080 every registered field kind has an actual typed fixture, unknown kinds fail",()=>{
 assert.deepEqual([...new Set(atlasCoverage.map(f=>f.kind))].sort(),[...FIELD_TYPES].sort());
 assert.equal(atlasSchema.classification,"TDD_DEFAULT");
 const tabs=composeTabs(atlasSchema);assert.equal(tabs[0].id,"overview");assert.equal(tabs.at(-1)?.id,"history");
 assert.throws(()=>validateModule({...atlasSchema,fields:[{...atlasSchema.fields[0],type:"invented"}]}));
 assert.ok(atlasRows().every(row=>row.name?.startsWith("DEMO")));
});
test("PAP1080 content uses no network even for list/detail/history and rejects outbound transport",async()=>{
 configureAtlas("populated");const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error("network forbidden");};
 const adapter=await createHoTddAdapter({registry:new TddRegistry(),definition:atlasDefinition,provider:atlasProvider,fetcher:atlasMemoryTransport,origin},signal());
 try {const list=await adapter.list(atlasQuery,signal());assert.equal(list.rows.length,24);const id=list.rows[0].id;assert.equal((await adapter.detail(id,signal()))?.row.id,id);const history=await adapter.history(adapter.subject(id),signal());assert.equal(history.status,"authorized");if(history.status==="authorized")assert.equal(history.events[0].source,"SYNTHETIC DEMO");assert.equal(adapter.mutation,undefined);await assert.rejects(atlasMemoryTransport("https://ho.staging.pinohouse.art/api/bo/centers"));await assert.rejects(atlasMemoryTransport(origin+"/api/bo/context",{method:"POST"}));}
 finally {adapter.dispose();globalThis.fetch=old;}
});
test("PAP1080 scenario cases are explicit, resettable and deny cross-surface providers",async()=>{
 for(const scenario of atlasScenarios){configureAtlas(scenario);const rows=atlasRows();assert.equal(rows.length,scenario==="empty"?0:scenario==="high-volume"?128:24);if(scenario==="null")assert.equal(rows[0].relation,null);}
 configureAtlas("populated");await assert.rejects(atlasProvider.list(atlasQuery,{surface:"BO",centerId:"demo"},atlasMemoryTransport,signal()));
});
test("PAP1080 exact route inherits host/auth guards; no production, BO or TOS admission",()=>{
 assert.equal(decideHostBoundary("ho.staging.pinohouse.art",path).action,"next");
 for(const host of ["ho.pinohouse.art","bo.staging.pinohouse.art","tos.staging.pinohouse.art","tos.pinohouse.art"])assert.equal(decideHostBoundary(host,path).action,"not_found");
 assert.equal(safeHoReturnTo(path),path);assert.equal(safeHoReturnTo(path+"/extra"),null);
 const layout=readFileSync("app/ho/layout.tsx","utf8");assert.match(layout,/await authorizeHoShell/);
 const client=readFileSync("app/ho/system/tdd-reference/ReferenceAtlas.tsx","utf8");assert.match(client,/ephemeral:true/);assert.doesNotMatch(client,/localStorage|sessionStorage|fetch\(/);
});
