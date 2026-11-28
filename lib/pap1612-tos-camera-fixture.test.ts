import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {createTosCameraReview,TOS_CAMERA_REVIEW_DATE,TOS_CAMERA_REVIEW_CENTER} from "./pap1612-tos-camera-fixture";
test("PAP-1612 isolated shift seed retains one assignment and no recorded wage/attendance",()=>{
 const a=createTosCameraReview(),b=createTosCameraReview();
 assert.equal(a.assignments.length,1);assert.equal(a.assignments[0].centerId,TOS_CAMERA_REVIEW_CENTER);assert.equal(a.assignments[0].workDate,TOS_CAMERA_REVIEW_DATE);
 assert.equal(a.current,null);assert.deepEqual(a.history,[]);assert.equal(a.dailyIncome?.data[0].amountMinor,null);a.assignments[0].status="changed";assert.equal(b.assignments[0].status,"ACTIVE");
});
test("PAP-1612 review skips live week request, availability and extra-time navigation",()=>{
 const s=readFileSync("app/components/tos-vnext/TosVNextShift.tsx","utf8");
 assert.match(s,/if\(localCameraReview\)return;\s*void workforceApi.schedule/);
 assert.match(s,/localCameraReview\?<p role="status">Đăng ký ca/);
 assert.match(s,/label==="Làm thêm giờ"&&!localCameraReview/);
 assert.match(s,/localCameraReview\?<CameraReviewContent\/>:<FrontCameraEvidenceContent showConfirmation\/>/);
 assert.match(s,/export function TosCameraReviewContent/);
 assert.match(s,/isTosCameraLocalReview\(location.origin,self.origin,location.pathname,location.search,location.hash\)/);
});