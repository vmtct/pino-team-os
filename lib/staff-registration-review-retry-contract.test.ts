import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/bo/staff/StaffRegistrationReviewQueue.tsx"),
  "utf8",
);

test("Staff registration review preserves idempotency keys across ambiguous retries", () => {
  assert.match(source, /StaffRegistrationReviewQueue\(\{service=boApi,/);
  assert.match(source, /approveAttempt = useRef<ReviewAttempt \| null>\(null\)/);
  assert.match(source, /rejectAttempt = useRef<ReviewAttempt \| null>\(null\)/);
  assert.match(source, /attempt\?\.requestId === selected\.id && attempt\.fingerprint === fingerprint/);
  assert.match(source, /approveStaffRegistration\(selected\.id, normalized, identity, idempotencyKey, existingStaffMemberId \|\| undefined\)/);
  assert.match(source, /attempt\?\.requestId === selected\.id && attempt\.fingerprint === reason/);
  assert.match(source, /rejectStaffRegistration\(selected\.id, reason, idempotencyKey\)/);
  assert.doesNotMatch(source, /approveStaffRegistration\([^\n]+crypto\.randomUUID\(\)/);
  assert.match(source, /pinoriaIdentity: identity/);
  assert.match(source, /CREATE_STAFF_ONLY_PERSON/);
  assert.match(source, /LINK_EXISTING_STUDENT/);
  assert.match(source, /service\.learners\(learnerSearch\.trim\(\), 50\)/);
  assert.match(source, /studentProfileId/);
  assert.match(source, /Access email already exists[\s\S]{0,200}await refresh\(\)/);
  assert.match(source, /accessUsersRequest = service\.accessUsers\(\)\.catch/);
  assert.match(source, /cause\.status === 401 \|\| cause\.status === 403/);
  assert.doesNotMatch(source, /rejectStaffRegistration\([^\n]+crypto\.randomUUID\(\)/);
});
test("PAP-2411 record switch resets drafts, same-record retry retains keys; stale reads ignored",()=>{
  assert.match(source,/if\(reviewTarget\.current===id\)return;\s*reviewTarget\.current=id;\s*setSelectedId\(id\);/);
  assert.match(source,/const generation=\+\+refreshGeneration\.current;/);
  assert.match(source,/if\(!current\(\)\)return;\s*setRequests\(nextRequests\)/);
  assert.match(source,/queueMicrotask\(\(\)=>\{if\(active\)void refresh\(\);\}\);/);
  assert.match(source,/active=false;invalidateRefresh\(\);/);
  assert.match(source,/invalidateRefresh=useCallback\(\(\)=>\{refreshGeneration\.current\+\+;\},\[\]\)/);
  assert.match(source,/if\(reviewInFlight\.current\|\|busy\)return;selectRecord\(row\.id\)/);
});
