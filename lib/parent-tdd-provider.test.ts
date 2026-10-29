import test from "node:test";
import assert from "node:assert/strict";
import { parentDefinition, parentQuery, parentSchema, parentProvider } from "@/app/bo/parents/schema";
import { readScopedParentDetail } from "@/app/bo/parents/provider";

const center = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const other = "01a0b29a-3acd-7a18-a0f2-cf6016548ab6";
const parent = "01a0b29a-3acd-7a18-a0f2-cf6016548ab7";
const contact = "01a0b29a-3acd-7a18-a0f2-cf6016548ab8";
const scope = { surface: "BO" as const, centerId: center };
const item = {
  id: parent, displayName: "Parent A", maskedContact: "09••••12",
  linkedStudentCount: 2, centers: ["Cơ sở Cần Thơ"],
  updatedAt: "2026-10-29T10:00:00Z", attention: null,
};
const detail = {
  id: parent, scopeCenterId: center,
  students: [{ id: contact, name: "Student A", relationship: "PARENT", linkedAt: "2026-10-27T00:00:00Z" }],
  contacts: [{ id: contact, type: "PHONE", maskedValue: "09••••12", primary: true, verified: true }],
  audit: [], auditAuthorized: false,
};
function api(directoryCenter = center, detailCenter = center, record = item) {
  const called: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input), "https://bo.staging.pinohouse.art");
    called.push(url.pathname + url.search);
    const data = url.pathname.endsWith("/directory")
      ? { scopeCenterId: directoryCenter, limit: 100, offset: 0, total: 1, items: [record] }
      : { ...detail, scopeCenterId: detailCenter };
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  return { fetcher, called };
}
test("PAP-1075 schema is typed and reserves canonical system tabs", () => {
  assert.equal(parentSchema.key, "parents");
  assert.equal(parentDefinition.drawer.density, "one-column");
  assert.equal(parentDefinition.detail.businessTabs[0].label, "Học viên");
  assert.equal(parentDefinition.detail.businessTabs[1].label, "Liên hệ");
  assert.deepEqual(parentQuery.visible.slice(0, 2), ["name", "maskedContact"]);
});
test("PAP-1075 provider maps only a Core-attested selected Center and redacted contact", async () => {
  const { fetcher, called } = api();
  const signal = new AbortController().signal;
  const result = await parentProvider.list(parentQuery, scope, fetcher, signal);
  assert.equal(result.total, 1);
  assert.equal(result.records[0].centerId, center);
  assert.equal(result.records[0].row.maskedContact, "09••••12");
  assert.equal(result.records[0].row.studentCount, 2);
  assert.equal((await parentProvider.detail(parent, scope, fetcher, signal))?.row.id, parent);
  assert.equal((await readScopedParentDetail(parent, scope, fetcher, signal)).contacts[0].maskedValue, "09••••12");
  assert.ok(called.every(path => path.includes("centerId=" + center)));
  assert.ok(called.some(path => path.includes("/identity/parents/" + parent + "/detail")));
});
test("PAP-1075 provider refuses missing or cross-Center Core receipts and raw PII", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(() => parentProvider.list(parentQuery, scope, api(other).fetcher, signal));
  await assert.rejects(() => parentProvider.detail(parent, scope, api(center, other).fetcher, signal));
  await assert.rejects(() => parentProvider.list(parentQuery, scope, api(center, center, { ...item, maskedContact: "0901234567" }).fetcher, signal));
  await assert.rejects(() => parentProvider.list(parentQuery, scope, api(center, center, { ...item, rawPhone: "0901234567" }).fetcher, signal));
  const injected: typeof fetch = async input => {
    const path = new URL(String(input), "https://bo.staging.pinohouse.art").pathname;
    const data = path.endsWith("/detail") ? { ...detail, rawPhone: "0901234567" } :
      { scopeCenterId: center, limit: 100, offset: 0, total: 1, items: [item] };
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
  await assert.rejects(() => readScopedParentDetail(parent, scope, injected, signal));
  await assert.rejects(() => parentProvider.list(parentQuery, { surface: "HO" }, api().fetcher, signal));
  await assert.rejects(() => readScopedParentDetail("invalid", scope, api().fetcher, signal));
});
