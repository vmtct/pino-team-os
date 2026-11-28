import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
test("PAP-1612 Ca Lam reuses front camera content and preserves no-write confirmation",()=>{
 const shift=readFileSync("app/components/tos-vnext/TosVNextShift.tsx","utf8");
 const panel=readFileSync("app/check-in/FrontCameraEvidence.tsx","utf8");
 assert.match(shift,/<AppSheet title="Chụp bằng chứng Check-in"[^>]*>\{localCameraReview\?<CameraReviewContent\/>:<FrontCameraEvidenceContent showConfirmation\/>\}<\/AppSheet>/);
 assert.doesNotMatch(shift,/getUserMedia|facingMode/);
 assert.match(panel,/facingMode: \{ exact: "user" \}/);
 assert.match(panel,/showConfirmation && <button[^>]*disabled/);
 assert.match(panel,/Chụp lại/);
 assert.match(panel,/Thử lại camera/);
 assert.doesNotMatch(panel,/type="file"|workforceApi\./);
});