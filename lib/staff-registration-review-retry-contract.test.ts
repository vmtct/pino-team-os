import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/bo/staff/StaffRegistrationReviewQueue.tsx"),
  "utf8",
);

test("Staff registration review preserves idempotency keys across ambiguous retries", () => {
  assert.match(source, /approveAttempt = useRef<ReviewAttempt \| null>\(null\)/);
  assert.match(source, /rejectAttempt = useRef<ReviewAttempt \| null>\(null\)/);
  assert.match(source, /attempt\?\.requestId === selected\.id && attempt\.fingerprint === fingerprint/);
  assert.match(source, /approveStaffRegistration\(selected\.id, normalized, idempotencyKey, existingStaffMemberId \|\| undefined\)/);
  assert.match(source, /attempt\?\.requestId === selected\.id && attempt\.fingerprint === reason/);
  assert.match(source, /rejectStaffRegistration\(selected\.id, reason, idempotencyKey\)/);
  assert.doesNotMatch(source, /approveStaffRegistration\([^\n]+crypto\.randomUUID\(\)/);
  assert.match(source, /Access email already exists[\s\S]{0,200}await refresh\(\)/);
  assert.match(source, /accessUsersRequest = boApi\.accessUsers\(\)\.catch/);
  assert.match(source, /cause\.status === 401 \|\| cause\.status === 403/);
  assert.doesNotMatch(source, /rejectStaffRegistration\([^\n]+crypto\.randomUUID\(\)/);
});