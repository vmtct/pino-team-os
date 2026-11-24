import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HO_PAGE_PATHS, HO_HOME_PATH, safeHoReturnTo, hoRecordId } from "./ho-routes";
import { hoRoutes } from "./ho-system";
import { decideHostBoundary } from "./host-boundary";
const ho="ho.staging.pinohouse.art";
test("HO route manifest keeps the approved distinct pages",()=>{
 // PAP-1606 / PAP-1601 PLT-UI-LOCALE-BO-HO: include approved Language Mapping alongside Custom Attributes.
 assert.equal(Object.keys(HO_PAGE_PATHS).length,30);
 assert.equal(new Set(Object.values(HO_PAGE_PATHS)).size,30);
 assert.equal(HO_PAGE_PATHS.postApproval,"/ho/content/post-approval");
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal(decideHostBoundary(host,HO_PAGE_PATHS.postApproval).action,"not_found");
 assert.equal(HO_PAGE_PATHS.languageMappings,"/ho/language-mappings");
 assert.equal(HO_PAGE_PATHS.paths,"/ho/learning/paths");
 assert.equal(HO_PAGE_PATHS.specialties,"/ho/learning/specialties");
 assert.equal(HO_PAGE_PATHS.mytimeWorkshops,"/ho/mytime-workshops");
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal(decideHostBoundary(host,HO_PAGE_PATHS.mytimeWorkshops).action,"not_found");
 assert.equal(HO_PAGE_PATHS.tvPolicies,"/ho/pinoria/tv-policies");
 assert.equal(HO_PAGE_PATHS.customAttributes,"/ho/system/custom-attributes");
 assert.equal(safeHoReturnTo("/ho/pinoria/tv-policies"),"/ho/pinoria/tv-policies");
 assert.equal(HO_PAGE_PATHS.globalTerms,"/ho/operating-cycle/global-terms");
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
test("Wish return-to preserves exact revision and tab, never foreign query",()=>{
 const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",p=HO_PAGE_PATHS.wishBanners;
 const q=p+"?record="+id+"&tab=items&wishSelection=pending&wishRevision=2";
 assert.equal(safeHoReturnTo(q),q);
 assert.equal(safeHoReturnTo(q+"&external=1"),null);
 assert.equal(safeHoReturnTo(q.replace("wishRevision=2","wishRevision=0")),null);
 assert.equal(safeHoReturnTo(q.replace(p,HO_PAGE_PATHS.wishPolicies)),null);
 for(const path of [HO_PAGE_PATHS.wishPolicies,p]){assert.equal(decideHostBoundary(ho,path).action,"next");for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal(decideHostBoundary(host,path).action,"not_found");}
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

test("PAP-2353 canonical Staff return-to handles legacy review and analytics without widening admission",()=>{
 const p=HO_PAGE_PATHS.staffs;
 assert.equal(safeHoReturnTo(p+"?utm_source=chatgpt.com"),p);
 assert.equal(safeHoReturnTo(p+"?m1Preview=1&utm_source=chatgpt.com"),p);
 assert.equal(safeHoReturnTo(p+"?m1Preview=1&record=STAFF-MOCK-001&utm_source=chatgpt.com"),p+"?record=STAFF-MOCK-001");
 for(const suffix of ["?m1Preview=0","?m1Preview=1&m1Preview=1","?m1Preview=1&redirect=//evil.example","?m1Preview=1&record=0198d050-56c1-7ac5-b9ab-b0e45d912345","?m1Preview=1&record=STAFF-MOCK-001&record=STAFF-MOCK-002"])assert.equal(safeHoReturnTo(p+suffix),null);
 assert.equal(safeHoReturnTo("/ho/centers?m1Preview=1"),null);
 assert.equal(safeHoReturnTo(p+"?record=0198d050-56c1-7ac5-b9ab-b0e45d912345"),p+"?record=0198d050-56c1-7ac5-b9ab-b0e45d912345");
});