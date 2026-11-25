import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeHoReturnTo,HO_PAGE_PATHS} from "./ho-routes";
import {hoModules} from "./ho-system";
import {decideHostBoundary} from "./host-boundary";
import {decideM1Preview} from "./m1-preview/admission.server";
const path="/ho/learning-spaces",host="ho.staging.pinohouse.art",id="01a1ef9f-d253-7e6b-ba2d-200887c4486f";
test("PAP-2369 canonical HO-only route and real return target",()=>{
 assert.equal(HO_PAGE_PATHS.learningSpaces,path);
 assert.equal(hoModules.learningSpaces.label,"Không gian học");
 assert.equal(safeHoReturnTo(path),path);
 assert.equal(safeHoReturnTo(path+"?utm_source=chatgpt&record="+id),path+"?record="+id);
 for(const q of ["record=real-id","record=","record=LEARNING-SPACE-MOCK-001","record="+id+"&record="+id,"m1Preview=1","next=/bo"])assert.equal(safeHoReturnTo(path+"?"+q),null,q);
 assert.equal(decideHostBoundary(host,path).action,"next");
 for(const h of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal(decideHostBoundary(h,path).action,"not_found");
});
test("PAP-2369 existing Founder authorization precedes real integration",()=>{
 const source=readFileSync("app/ho/learning-spaces/page.tsx","utf8");
 assert.ok(source.indexOf("await authorizeHoShell(")<source.indexOf("if(!actor.entitled"));
 assert.match(source,/!actor\.permissionKeys\.includes\(SPACE_READ\)/);
 assert.match(source,/liveReadOnly liveWrites/);
 assert.match(source,/LearningSpaceM1Content key=\{actor\.userId\}/);
 const input={environment:"staging",hostname:host,surface:"HO" as const,requested:true,featureEnabled:true,authenticated:true,surfaceAuthorized:true,featureReviewAuthorized:true,scopeAuthorized:true};
 assert.equal(decideM1Preview(input).allowed,true);
 for(const delta of [{environment:"production"},{hostname:"bo.staging.pinohouse.art"},{authenticated:false},{surfaceAuthorized:false},{featureReviewAuthorized:false},{scopeAuthorized:false},{featureEnabled:false}])assert.equal(decideM1Preview({...input,...delta}).allowed,false);
});
