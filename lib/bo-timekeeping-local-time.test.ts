import test from "node:test";
import assert from "node:assert/strict";
import { isoToLocalInput, localInputToIso } from "./bo-timekeeping-local-time";

test("PAP-670 center Asia/Ho_Chi_Minh local time converts to canonical UTC", () => {
 assert.equal(isoToLocalInput("2026-10-17T07:05:00.000Z","Asia/Ho_Chi_Minh"),"2026-10-17T14:05");
 assert.equal(localInputToIso("2026-10-17T14:05","Asia/Ho_Chi_Minh"),"2026-10-17T07:05:00.000Z");
});
test("PAP-670 rejects invalid local time and DST spring gap",()=>{
 assert.equal(localInputToIso("2026-02-30T09:00","Asia/Ho_Chi_Minh"),null);
 assert.equal(localInputToIso("2026-03-08T02:30","America/New_York"),null);
 assert.equal(localInputToIso("not-a-date","Asia/Ho_Chi_Minh"),null);
});
test("PAP-670 rejects ambiguous DST fall-back time",()=>{
 assert.equal(localInputToIso("2026-11-01T01:30","America/New_York"),null);
 assert.equal(localInputToIso("2026-11-01T03:30","America/New_York"),"2026-11-01T08:30:00.000Z");
});
