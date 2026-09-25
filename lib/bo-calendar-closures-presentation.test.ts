import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BO_HOSTNAME, decideHostBoundary } from "./host-boundary";

const read = (path: string) => readFile(path, "utf8");

test("Calendar workspace remains a Core-authoritative presentation consumer", async () => {
  const [view, api, navigation] = await Promise.all([
    read("app/bo/calendar/BoCalendarClosuresView.tsx"),
    read("lib/bo-api.ts"),
    read("app/bo/navigation.ts"),
  ]);
  assert.match(navigation, /href: "\/bo\/calendar"/);
  for (const command of ["calendarExclusions", "previewCalendarExclusion", "createCalendarExclusion", "archiveCalendarExclusion"]) {
    assert.match(view, new RegExp(`boApi\\.${command}`));
    assert.match(api, new RegExp(`${command}:`));
  }
  assert.match(view, /if \(!command \|\| !impact\) return/);
  assert.match(view, /disabled=\{busy \|\| protectedTruth > 0 \|\| missingReasonDetail\}/);
  assert.match(view, /setPublishKey\(crypto\.randomUUID\(\)\)/);
  assert.match(api, /createCalendarExclusion:[^\n]+idempotencyKey: string/);
  assert.doesNotMatch(view, /fetch\(/);
});

test("Calendar workspace is confined to the governed BO host boundary", () => {
  const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  for (const path of [
    "/bo/calendar",
    "/api/bo/delivery/calendar-exclusions",
    "/api/bo/delivery/calendar-exclusions/preview",
    `/api/bo/delivery/calendar-exclusions/${id}`,
  ]) assert.deepEqual(decideHostBoundary(BO_HOSTNAME, path), { action: "next" });
});
