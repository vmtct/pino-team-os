import test from "node:test";
import assert from "node:assert/strict";
import { assignmentDefinition, assignmentProvider, assignmentQuery } from "../app/bo/missions/schema";

const center = "01900000-0000-7000-8000-000000000001";
const a = "01900000-0000-7000-8000-000000000002";
const b = "01900000-0000-7000-8000-000000000004";
const cancelledId = "01900000-0000-7000-8000-000000000005";
const actor = "01900000-0000-7000-8000-000000000003";
const assigned = (id: string, status: "ASSIGNED" | "CANCELLED" = "ASSIGNED") => ({
  id, centerId: center, studentId: actor, missionId: actor,
  missionCodeSnapshot: "QA-C1", missionNameSnapshot: "Independent C1",
  contextKey: "", contextLabel: null, status, assignedAt: "2026-11-09T11:00:00.000Z",
  assignedByUserId: actor, updatedAt: "2026-11-09T11:00:00.000Z",
  updatedByUserId: actor, cancelledAt: status === "CANCELLED" ? "2026-11-09T11:10:00.000Z" : null,
  cancelledReason: status === "CANCELLED" ? "QA cancelled" : null, version: 1,
});
const source = [assigned(a), assigned(b), assigned(cancelledId, "CANCELLED")];
const complete = (id: string) => ({
  centerId: center, assignmentId: id, assignmentStatus: "ASSIGNED",
  executionStatus: id === a ? "COMPLETED" : "IN_PROGRESS",
  executionVersion: id === a ? 1 : 2,
  updatedAt: "2026-11-10T01:13:37.384Z", updatedByUserId: actor,
});
const abort = () => new AbortController().signal;

test("PAP-1792: views expose independent C1 progress without changing Assignment lifecycle", () => {
  const fields = assignmentDefinition.fields.map(f => f.key);
  assert.ok(fields.includes("executionStatus"), "C1 execution source-backed field required");
  assert.ok(fields.includes("executionVersion"), "C1 version source-backed field required");
  assert.ok(assignmentQuery.visible.includes("executionStatus" as never), "C1 visible in default Table");
  const builtIn = assignmentDefinition.table.views.builtIn;
  assert.deepEqual(builtIn.filter(v => ["in-progress", "completed"].includes(v.id)).map(v =>
    [v.id, v.label, v.state.filters.rules[0]]), [
      ["in-progress", "Đang thực hiện", { field: "executionStatus", op: "eq", value: "Đang thực hiện" }],
      ["completed", "Hoàn tất", { field: "executionStatus", op: "eq", value: "Hoàn tất" }],
    ]);
  assert.ok(assignmentDefinition.detail.overview.sections.some(s => s.fields.includes("executionStatus" as never)));
  assert.ok(assignmentDefinition.detail.overview.sections.some(s => s.fields.includes("status")));
});

test("PAP-1792: Center-verified independent Core GET populates C1 Table/Detail; cancelled never becomes IN_PROGRESS", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.includes("/execution?")) {
      const id = url.split("/mission-assignments/")[1]!.split("/")[0]!;
      return Response.json({ data: complete(id) });
    }
    if (url.includes("/mission-assignments/")) {
      const id = url.split("/mission-assignments/")[1]!.split("?")[0]!;
      return Response.json({ data: source.find(x => x.id === id) });
    }
    return Response.json({ data: source });
  };
  const result = await assignmentProvider.list(assignmentQuery, { surface: "BO", centerId: center }, fetcher, abort());
  assert.equal(result.total, 3);
  assert.equal(result.records[0]?.row.status, "Đang giao");
  assert.equal(result.records[1]?.row.status, "Đang giao");
  const fields = result.records.map(x => x.row as Record<string, unknown>);
  assert.deepEqual(fields.map(x => x.executionStatus), ["Hoàn tất", "Đang thực hiện", null]);
  assert.deepEqual(fields.map(x => x.executionVersion), [1, 2, null]);
  assert.equal(calls.filter(x => x.includes("/execution?")).length, 2, "do not query cancelled C1");
  assert.ok(!calls.some(x => x.includes(cancelledId + "/execution")), "cancelled has no C1 progress");
  const detail = await assignmentProvider.detail(a, { surface: "BO", centerId: center }, fetcher, abort());
  assert.equal((detail?.row as Record<string, unknown>)?.executionStatus, "Hoàn tất");
  assert.equal(detail?.row.status, "Đang giao");
});

test("PAP-1792: Core wrong-Center execution projection fails closed, not synthetic status", async () => {
  const fetcher: typeof fetch = async input => {
    if (String(input).includes("/execution?"))
      return Response.json({ data: { ...complete(a), centerId: actor } });
    return Response.json({ data: [assigned(a)] });
  };
  await assert.rejects(assignmentProvider.list(assignmentQuery, { surface: "BO", centerId: center }, fetcher, abort()));
});
