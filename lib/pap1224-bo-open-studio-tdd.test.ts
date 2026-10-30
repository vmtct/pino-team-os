import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateModule} from "./workspace-schema";
import {decideHostBoundary} from "./host-boundary";
import {BO_TARGET_ROUTES,buildBoTargetUrl} from "./bo-url-contract";
import {isBoStagingRouteAdmitted} from "../app/bo/architecture/bo-staging-route-policy";
import {passDefinition,passSchema,passProvider,passQuery,readCenterPasses,isActiveBoCenter} from "../app/bo/open-studio-passes/schema";

const center="00000000-0000-4000-8000-000000000015",other="00000000-0000-4000-8000-000000000016";
const id="00000000-0000-4000-8000-000000000017";
const record={id,code:"PINO-OS-0011223344",status:"ASSIGNED",path_code:"LPP",center_id:center,parent_user_id:null};
const reply=(body:unknown,status=200)=>async (_input:unknown)=>Response.json(body,{status});

test("PAP-1224: BO Pass uses registered exact TDD on Staging, no route bypass",()=>{
 validateModule(passSchema);
 assert.equal(passSchema.key,"open-studio-passes");
 assert.equal(passDefinition.surface,"BO");
 assert.equal(passDefinition.capabilities.read,"open_studio.walkin_pass.manage");
 assert.equal(passDefinition.detail.history.kind,"unavailable");
 assert.equal(passProvider.pagination,"local-ui");
 assert.equal(isBoStagingRouteAdmitted("/bo/open-studio-passes"),true);
 assert.equal(buildBoTargetUrl({moduleKey:"open-studio-passes",surface:"table"}),"/bo/open-studio-passes");
 assert.ok(BO_TARGET_ROUTES.some(r=>r.key==="open-studio-passes"&&r.path==="/bo/open-studio-passes"));
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art","/bo/open-studio-passes","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/bo/open-studio-passes","GET"),{action:"not_found"});
 const page=readFileSync("app/bo/open-studio-passes/page.tsx","utf8");
 const tdd=readFileSync("app/bo/open-studio-passes/BoOpenStudioPassesTdd.tsx","utf8");
 assert.match(page,/BoOpenStudioPassesTdd/);
 assert.doesNotMatch(page,/OpenStudioView/); // No legacy shell in TDD admission.
 assert.match(tdd,/createBoTddAdapter/);
 assert.match(tdd,/SurfaceWorkspace/);
 assert.match(tdd,/CenterPassActions centerId=\{centerId\}/);
 assert.match(tdd,/@pino\/design-system\/components\.css/);
 assert.doesNotMatch(tdd,/<table\b/);
 const middleware=readFileSync("middleware.ts","utf8");
 assert.ok(middleware.includes('target.pathname="/bo/open-studio-passes"'));
});

test("PAP-1224: live BO centers use lowercase active status, strict UUID and deny inactive",()=>{
 assert.equal(isActiveBoCenter({id:center,status:"active"}),true);
 assert.equal(isActiveBoCenter({id:other,status:"active"}),true);
 assert.equal(isActiveBoCenter({id:center,status:"ACTIVE"}),false);
 assert.equal(isActiveBoCenter({id:center,status:"inactive"}),false);
 assert.equal(isActiveBoCenter({id:"bad-id",status:"active"}),false);
});

test("PAP-1224: Center-bound API request and negative cross-Center projection",async()=>{
 const ctl=new AbortController();
 let requested="";
 const fetcher=async (input:RequestInfo|URL)=>{requested=String(input);return Response.json({data:[record]});};
 const rows=await readCenterPasses(fetcher as typeof fetch,center,ctl.signal);
 assert.equal(rows.length,1);
 assert.match(requested,/centerId=/);
 const result=await passProvider.list(passQuery,{surface:"BO",centerId:center},fetcher as typeof fetch,ctl.signal);
 assert.equal(result.total,1);assert.equal(result.records[0]?.centerId,center);
 assert.equal(result.records[0]?.row.code,record.code);
 assert.equal((await passProvider.detail(id,{surface:"BO",centerId:center},fetcher as typeof fetch,ctl.signal))?.row.id,id);
 assert.equal(await passProvider.detail(other,{surface:"BO",centerId:center},fetcher as typeof fetch,ctl.signal),null);
 for(const bad of [
  {data:[{...record,center_id:other}]},{data:[{...record,id:"bad-id"}]},
  {data:[{...record,code:"FRAUD"}]},{data:[{...record,status:"PAID"}]},
  {data:[{...record,path_code:"OTHER"}]},{data:[record,record]},
  {data:{items:[record]}}
 ])await assert.rejects(readCenterPasses(reply(bad) as typeof fetch,center,ctl.signal));
 await assert.rejects(readCenterPasses(reply({error:"403"},403) as typeof fetch,center,ctl.signal));
 await assert.rejects(passProvider.list(passQuery,{surface:"HO"},fetcher as typeof fetch,ctl.signal),/BO Center/);
});
