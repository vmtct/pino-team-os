import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tvRuntimeCookie, TV_RUNTIME_COOKIE } from "./tv-runtime-core";

const read=(path:string)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("TV launcher exposes deterministic automation metadata and bounded launch path",()=>{
 const source=read("app/tv/TvLauncher.tsx");
 for(const marker of ["data-tv-id","data-tv-key","data-tv-runtime","data-tv-scope","data-tv-orientation",'data-tv-action="open-here"']) assert.ok(source.includes(marker),marker);
 assert.ok(source.includes("/api/tv/${tv.id}/launch"));
 assert.ok(source.includes("router.push(`/tv/${tv.id}`)"));
});

test("runtime host enforces declared orientation and delegates PINORIA_HOUSE to existing runtime",()=>{
 const source=read("app/tv/[displayId]/TvRuntimeHost.tsx");
 assert.ok(source.includes("actual!==context.display.orientation"));
 assert.ok(source.includes('data-tv-orientation-mismatch="true"'));
 assert.ok(source.includes('context.display.runtimeType==="PINORIA_HOUSE"'));
 assert.ok(source.includes("fixedCenterId={context.display.scopeId}"));
 assert.ok(source.includes("/api/tv/runtime/${displayId}/pinoria-house"));
});

test("runtime token is HttpOnly and never returned to browser launch response",()=>{
 const source=read("app/api/tv/[displayId]/launch/route.ts");
 assert.ok(source.includes("HttpOnly; Secure; SameSite=Lax"));
 assert.ok(source.includes("runtimeToken"));
 assert.ok(source.includes("Response.json({data:{session:"));
 assert.ok(!source.includes("Response.json({data:{runtimeToken"));
});

test("runtime cookie parser accepts only the named opaque session cookie",()=>{
 const request=new Request("https://tos.pinohouse.art/tv/x",{headers:{cookie:"other=1; "+TV_RUNTIME_COOKIE+"=opaque-token; x=2"}});
 assert.equal(tvRuntimeCookie(request),"opaque-token");
 assert.equal(tvRuntimeCookie(new Request("https://tos.pinohouse.art/tv/x")),"");
});

test("runtime presentation facade preserves the legacy browser envelope",()=>{
 const source=read("app/api/tv/runtime/[displayId]/pinoria-house/presentation/route.ts");
 assert.ok(source.includes("{presentation:envelope.data??null}"));
 assert.ok(source.includes("{ok:true,...completed as Record<string,unknown>}"));
 assert.ok(source.includes("if(result.status!==200)return runtimeJson(result)"));
});

test("Pinoria runtime accepts a generic API base and legacy route migrates to TV launcher",()=>{
 const reception=read("app/pinoria-tv/reception-tv.tsx"),presentation=read("app/pinoria-tv/presentation-client.ts"),legacy=read("app/pinoria-tv/page.tsx");
 assert.ok(reception.includes('apiBase = "/api/pinoria-tv"'));
 assert.ok(reception.includes("${apiBase}/snapshot"));
 assert.ok(reception.includes("claimPresentation(centerId, apiBase)"));
 assert.ok(presentation.includes("apiBase"));
 assert.ok(legacy.includes('redirect("/tv")'));
});

test("BO TV definitions are readonly while Devices remain operationally registerable",()=>{
 const source=read("app/bo/tvs/TvManagementView.tsx");
 assert.ok(source.includes("TV definitions được provision bằng code"));
 assert.ok(source.includes('fetch("/api/bo/tv/devices",{method:"POST"'));
 assert.ok(!source.includes('fetch("/api/bo/tv/displays",{method:"POST"'));
});

test("BO write facade admits only bounded TV device mutations",()=>{
 const source=read("lib/bo-write-handler.ts");
 assert.ok(source.includes("path === TV_DEVICE_CREATE"));
 assert.ok(source.includes("TV_DEVICE_UPDATE.test(path)"));
 assert.ok(!source.match(/shouldReconcileTosAccess[\s\S]{0,220}TV_DEVICE_CREATE/));
});

test("generic TOS proxy cannot expose TV runtime authority",()=>{
 const source=read("app/api/tos-learning/[...path]/route.ts");
 assert.ok(source.includes("^tv\\/displays\\/[0-9a-f-]{36}\\/launch$"));
 assert.ok(source.includes('"PLATFORM_NOT_FOUND"'));
});

test("production release binding inventory keeps TV runtime binding inside the YAML script",()=>{
 const source=read(".github/workflows/team-runtime-production-release.yml");
 assert.ok(source.includes("          PINO_TV_RUNTIME_CORE|pino-core|DisplayRuntimeControlPlane"));
 assert.ok(!source.includes("\nPINO_TV_RUNTIME_CORE|pino-core|DisplayRuntimeControlPlane\n"));
});
