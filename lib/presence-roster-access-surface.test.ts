import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("BO Staff page exposes the selectable Presence/roster access lifecycle", async () => {
  const page = await readFile(resolve("app/bo/staff/page.tsx"), "utf8");
  const surface = await readFile(resolve("app/bo/staff/PresenceRosterAccessActivation.tsx"), "utf8");

  assert.match(page, /PresenceRosterAccessActivation/);
  assert.match(surface, /boApi\.staffRecords\(\)/);
  assert.match(surface, /boApi\.accessUsers\(\)/);
  assert.match(surface, /boApi\.scopeCatalog\(\)/);
  assert.match(surface, /ensurePresenceRosterAccess/);
  assert.match(surface, /removePresenceRosterAccess/);
  assert.doesNotMatch(surface, /01a04173-1a99-7292-8718-bb970c7126e5/);
  assert.doesNotMatch(surface, /01a02354-6be1-7c77-a2dd-513052a18b98/);
});

test("legacy hard-coded F2 activation is no longer mounted", async () => {
  const page = await readFile(resolve("app/bo/staff/page.tsx"), "utf8");
  assert.doesNotMatch(page, /F2LearningOperatorActivation/);
});
