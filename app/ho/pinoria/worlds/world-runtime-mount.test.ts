import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(name:string)=>readFileSync(new URL(name,import.meta.url),"utf8");
test("PAP-2143 real route retains server authorization and uses native catalog without fixture",()=>{
 const page=source("./page.tsx");
 assert.match(page,/await authorizeHoShell/);
 assert.ok(page.includes('context.permissionKeys.includes("pinoria.world.view")'));
 assert.ok(page.includes('<HoWorldCatalog canManage={context.permissionKeys.includes("pinoria.world.manage")}'));
 assert.doesNotMatch(page,/HoWorldActivationM1|createWorldStagingBoundary/);
});
test("PAP-2143 shared detail permits authorized real activation, retains explicit confirmation and reload on failure",()=>{
 const detail=source("./HoWorldRuntimeDetail.tsx");
 assert.ok(detail.includes('if(!world||!canManage||flight.current||world.status!=="DRAFT"'));
 assert.ok(detail.includes('{canManage&&world.status==="DRAFT"'));
 assert.ok(detail.includes('if(activationVersion!==world.version){setActivationVersion(world.version);return;}'));
 assert.ok(detail.includes('mutate(()=>activateWorld(world,transport)).catch(()=>{if(mounted.current)setResult({world:null,error:'));
 assert.ok(!detail.includes('if(!previewTransport||!world||!canManage'));
});
