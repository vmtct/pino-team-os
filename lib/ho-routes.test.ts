import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HO_PAGE_PATHS, HO_HOME_PATH, safeHoReturnTo, hoRecordId } from "./ho-routes";
import { hoRoutes } from "./ho-system";
import { decideHostBoundary } from "./host-boundary";
const ho="ho.staging.pinohouse.art";
test("HO route manifest keeps the approved distinct pages",()=>{
 assert.equal(Object.keys(HO_PAGE_PATHS).length,16);
 assert.equal(new Set(Object.values(HO_PAGE_PATHS)).size,16);
 assert.deepEqual(hoRoutes, HO_PAGE_PATHS);
 assert.equal(HO_PAGE_PATHS.walkinPasses,"/ho/open-studio/walkin");
 assert.equal(HO_PAGE_PATHS.termWeeks,"/ho/workforce/term-weeks");
 assert.equal(HO_PAGE_PATHS.shiftTemplates,"/ho/workforce/shift-templates");
 assert.equal(HO_HOME_PATH,"/ho/centers");
 assert.deepEqual(decideHostBoundary(ho,"/"), {action:"redirect",pathname:HO_HOME_PATH});
 for(const path of Object.values(HO_PAGE_PATHS))assert.equal(decideHostBoundary(ho,path).action,"next",path);
 for(const path of ["/ho/system/permissions","/ho/path/not-approved"]) assert.equal(decideHostBoundary(ho,path).action,"not_found");
});
test("returnTo fails closed on foreign origin, auth pages, duplicate or malformed query",()=>{
 for(const value of [null,"","//evil.example/ho/centers","https://evil.example","/staff-login","/bo","/ho/unknown","/ho/system/audit?from=abc","/ho/centers?record=a&record=b","/ho/centers?redirect=//evil.example","/ho/centers#fragment","/ho/centers%5c..","/ho/centers?record=bad%2Fother"]){
  assert.equal(safeHoReturnTo(value),null,String(value));
 }
 for(const path of Object.values(HO_PAGE_PATHS))assert.equal(safeHoReturnTo(path),path);
 assert.equal(safeHoReturnTo("/ho/centers?record=0198d050-56c1-7ac5-b9ab-b0e45d912345"),"/ho/centers?record=0198d050-56c1-7ac5-b9ab-b0e45d912345");
 assert.equal(hoRecordId("glow"),"glow");
 assert.equal(hoRecordId("../etc"),null);
});
test("HO and BO sidebars both use client routing with prefetch disabled",()=>{
 const ws=readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx","utf8");
 assert.match(ws,/ho \? <Link/);
 assert.match(ws,/prefetch=\{false\}/);
 assert.match(ws,/onOpen=\{record =>/);
 assert.match(ws,/window\.addEventListener\("popstate", onBack\)/);
 assert.match(ws,/sessionStorage\.setItem\("pino:ho:sidebar:v1"/);
 assert.match(ws,/: <Link prefetch=\{false\}/);
 assert.doesNotMatch(ws,/: <a className=/);
});
test("middleware and auth pages preserve safe return-to only for HO",()=>{
 const middleware=readFileSync("middleware.ts","utf8");
 const layout=readFileSync("app/ho/layout.tsx","utf8");
 const login=readFileSync("app/staff-login/page.tsx","utf8");
 const password=readFileSync("app/staff-password/change/page.tsx","utf8");
 assert.match(middleware,/forwarded\.delete\("x-pino-ho-return-to"\)/);
 assert.match(middleware,/login\.searchParams\.set\("returnTo", ret\)/);
 assert.match(layout,/safeHoReturnTo\(requestHeaders\.get\("x-pino-ho-return-to"\)\)/);
 assert.match(login,/safeHoReturnTo\(new URLSearchParams\(window\.location\.search\)\.get\("returnTo"\)\)/);
 assert.match(password,/safeHoReturnTo\(new URLSearchParams\(window\.location\.search\)\.get\("returnTo"\)\)/);
});
