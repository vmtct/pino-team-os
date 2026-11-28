import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const entry=readFileSync("app/components/tos-vnext/TosCameraStageEntry.tsx","utf8");
const review=readFileSync("app/components/tos-vnext/TosCameraStageReview.tsx","utf8");
test("PAP-1612 TOS feature-local server entry verifies exact route and staff admission before rendering",()=>{
 assert.match(entry,/incoming\.get\("host"\)!==CAMERA_STAGE_HOST\.TOS/);
 assert.match(entry,/if\(!parseCameraStageReview\("TOS",url,env\)\)notFound\(\)/);
 assert.match(entry,/await authorizeTosCameraStageReview\(url,incoming,env\)\.catch\(\(\)=>forbidden\(\)\)/);
 assert.match(entry,/proof=\{proof\}/);
});
test("PAP-1612 TOS stage wrapper verifies client proof before same approved synthetic frame",()=>{
 assert.match(review,/query\.size!==2/);
 assert.match(review,/query\.get\("centerId"\)!==proof\.centerId/);
 assert.match(review,/verifyCameraStageClient\("TOS",new URL\(location\.href\),proof,controller\.signal\)/);
 assert.match(review,/if\(status!=="ready"\)return/);
 assert.match(review,/<TosVNextFrame app="shift"><TosCameraReviewContent data=\{fixture\}/);
 assert.match(review,/centerId=\{TOS_CAMERA_REVIEW_CENTER\}/);
 assert.doesNotMatch(review,/workforceApi\.|getUserMedia|localStorage|sessionStorage/);
});
