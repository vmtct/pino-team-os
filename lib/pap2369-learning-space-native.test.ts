import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeHoReturnTo,HO_PAGE_PATHS} from "./ho-routes";
import {hoModules} from "./ho-system";
import {decideHostBoundary} from "./host-boundary";
import {decideM1Preview} from "./m1-preview/admission.server";
const path="/ho/learning-spaces",host="ho.staging.pinohouse.art";
test("PAP-2369 canonical HO-only route and synthetic return target",()=>{
 assert.equal(HO_PAGE_PATHS.learningSpaces,path);
 assert.equal(hoModules.learningSpaces.label,"Không gian học");
 assert.equal(safeHoReturnTo(path),path);
 assert.equal(safeHoReturnTo(path+"?utm_source=chatgpt&record=LEARNING-SPACE-MOCK-001"),path+"?record=LEARNING-SPACE-MOCK-001");
 for(const q of ["record=real-id","record=","record=LEARNING-SPACE-MOCK-001&record=LEARNING-SPACE-MOCK-001","m1Preview=1","next=/bo"])assert.equal(safeHoReturnTo(path+"?"+q),null,q);
 assert.equal(decideHostBoundary(host,path).action,"next");
 for(const h of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal(decideHostBoundary(h,path).action,"not_found");
});
test("PAP-2369 existing Founder authorization precedes synthetic-only admission",()=>{
 const source=readFileSync("app/ho/learning-spaces/page.tsx","utf8");
 assert.ok(source.indexOf("await authorizeHoShell(")<source.indexOf("const review=decideM1Preview("));
 assert.match(source,/actor\.permissionKeys\.includes\(SPACE_READ\)&&actor\.permissionKeys\.includes\(SPACE_EDIT\)/);
 assert.match(source,/if\(!review\.allowed\)forbidden\(\)/);
 assert.match(source,/LearningSpaceM1Content key=\{actor\.userId\}/);
 const input={environment:"staging",hostname:host,surface:"HO" as const,requested:true,featureEnabled:true,authenticated:true,surfaceAuthorized:true,featureReviewAuthorized:true,scopeAuthorized:true};
 assert.equal(decideM1Preview(input).allowed,true);
 for(const delta of [{environment:"production"},{hostname:"bo.staging.pinohouse.art"},{authenticated:false},{surfaceAuthorized:false},{featureReviewAuthorized:false},{scopeAuthorized:false},{featureEnabled:false}])assert.equal(decideM1Preview({...input,...delta}).allowed,false);
});
