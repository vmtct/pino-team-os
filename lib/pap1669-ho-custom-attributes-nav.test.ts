/* PAP-1669 / PLT-ATTR — FSG1 navigation/role boundary contract */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HO_PAGE_PATHS, safeHoReturnTo } from "./ho-routes";
import { hoRoutes, hoModules } from "./ho-system";
import { decideHostBoundary, HO_STAGING_HOSTNAME } from "./host-boundary";
const route="/ho/system/custom-attributes";
test("PAP-1669 HO Custom Attributes uses one approved route and System nav item",()=>{
 assert.equal(HO_PAGE_PATHS.customAttributes,route);
 assert.equal(hoRoutes.customAttributes,route);
 assert.equal(hoModules.customAttributes.group,"System");
 assert.equal(hoModules.customAttributes.label,"Custom Attributes");
 assert.equal(hoModules.customAttributes.fields.length,0,"no Table fields or fake data in FSG1");
 assert.equal(Object.values(hoRoutes).filter(v=>v===route).length,1);
 assert.equal(safeHoReturnTo(route),route);
});
test("PAP-1669 HO route fail-closed host and methods; no new API admission",()=>{
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,route,"GET").action,"next");
 for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS"])assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,route,method).action,"not_found");
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","localhost:3000"])
  assert.equal(decideHostBoundary(host,route,"GET").action,"not_found",host);
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,route+"/edit","GET").action,"not_found");
});
test("PAP-1669 FSG1 route reuses Founder-only HO shell and only empty-state UI",()=>{
 const layout=readFileSync("app/ho/layout.tsx","utf8");
 const auth=readFileSync("lib/ho-auth.ts","utf8");
 const source=readFileSync("app/ho/system/custom-attributes/page.tsx","utf8");
 assert.match(layout,/await authorizeHoShell\(requestHeaders, env\)/);
 assert.match(auth,/HO_PILOT_FOUNDER_USER_IDS/);
 assert.match(auth,/path:"ho\/admission"/);
 assert.match(source,/module="customAttributes"/);
 assert.match(source,/useContext\(TddHostMenu\)/);
 assert.match(source,/role="status"/);
 assert.doesNotMatch(source,/boApi\.|fetch\(|onSave|mutation=/);
});
