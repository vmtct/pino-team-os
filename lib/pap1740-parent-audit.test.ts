// PAP-1740 / SCH-PARENTS-GUARDIANS: typed audit properties and safe Core rollout.
import test from "node:test";
import assert from "node:assert/strict";
import { parentDefinition, parentFields, parentQuery } from "@/app/bo/parents/schema";
import { readScopedParentDirectory } from "@/app/bo/parents/provider";
import { isFieldValue } from "@/lib/workspace-schema";

const center = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const parentId = "01a1be6d-b06c-7868-be08-bbed0d3a9a8f";
const sample = {
  id: parentId, displayName: "Parent QA", maskedContact: "q•••@example.invalid",
  linkedStudentCount: 0, centers: ["Cần Thơ"], updatedAt: "2026-11-09T03:50:22Z", attention: null,
};
const api = (row: Record<string, unknown>): typeof fetch => async () => new Response(JSON.stringify({
  data: { scopeCenterId: center, limit: 100, offset: 0, total: 1, items: [row] },
}), { status: 200, headers: { "Content-Type": "application/json" } });

test("PAP-1740 FSG3 Table, Quick Drawer and Detail share four default audit fields", () => {
  assert.deepEqual(parentQuery.visible.slice(-4), ["createdAt", "createdBy", "updatedAt", "updatedBy"]);
  assert.deepEqual(parentDefinition.drawer.sections.flatMap(section => [...section.fields]), parentQuery.visible);
  assert.deepEqual(parentDefinition.detail.overview.sections.flatMap(section => [...section.fields]), parentQuery.visible);
  assert.equal(parentFields.find(f => f.key === "createdAt")?.type, "datetime");
  assert.equal(parentFields.find(f => f.key === "updatedAt")?.type, "datetime");
  assert.equal(parentFields.find(f => f.key === "createdBy")?.label, "Created by (User)");
  assert.equal(parentFields.find(f => f.key === "updatedBy")?.label, "Last Modified By (User)");
});

test("PAP-1740 accepts both pre-Core and new Core directory projection without fake actors", async () => {
  const pre = await readScopedParentDirectory(center, api(sample), new AbortController().signal);
  assert.equal(pre[0].createdAt, null);
  assert.equal(isFieldValue("datetime", pre[0].createdAt), true, "old Core must pass typed TDD projection");
  assert.equal(pre[0].createdBy, "—");
  assert.equal(pre[0].updatedBy, "—");
  const current = await readScopedParentDirectory(center, api({
    ...sample, createdAt: "2026-11-09T03:50:22Z", createdBy: null, updatedBy: null,
  }), new AbortController().signal);
  assert.equal(current[0].createdAt, "2026-11-09T03:50:22Z");
  assert.equal(isFieldValue("datetime", current[0].createdAt), true);
  assert.equal(current[0].updatedAt, sample.updatedAt);
  assert.equal(current[0].studentCount, 0);
  assert.equal(current[0].maskedContact, "q•••@example.invalid");
  assert.equal(current[0].createdBy, "—");
  assert.equal(current[0].updatedBy, "—");
});

test("PAP-1740 denies unverified actor strings or malformed timestamp from Core", async () => {
  await assert.rejects(() => readScopedParentDirectory(center, api({
    ...sample, createdBy: "UNVERIFIED_PERSON", createdAt: "2026-11-09T03:50:22Z",
  }), new AbortController().signal), /invalid/i);
  await assert.rejects(() => readScopedParentDirectory(center, api({
    ...sample, createdBy: null, updatedBy: null, createdAt: "fake-time",
  }), new AbortController().signal), /invalid/i);
});
