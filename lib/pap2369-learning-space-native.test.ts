import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {safeHoReturnTo,HO_PAGE_PATHS} from "./ho-routes";
import {hoModules} from "./ho-system";
import {decideHostBoundary} from "./host-boundary";

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
 assert.doesNotMatch(source,/liveReadOnly|liveWrites|decideM1Preview|m1Preview/);
 assert.match(source,/LearningSpaceM1Content key=\{actor\.userId\}/);
 const content=readFileSync("app/ho/learning-spaces/LearningSpaceM1Content.tsx","utf8");
 assert.doesNotMatch(content,/learning-space-m1-preview|createPreviewState|mockCenters|liveReadOnly|liveWrites/);
 for(const path of ["app/ho/learning-spaces/learning-space-m1-preview.ts","app/ho/learning-spaces/local-entry.tsx","scripts/build-native-m1-learning-spaces.mjs"])assert.equal(existsSync(path),false);
});
