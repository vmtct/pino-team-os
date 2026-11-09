// PAP-1739 / SCH-PARENTS-GUARDIANS — FSG3 canonical Parent List quick views.
import test from "node:test";
import assert from "node:assert/strict";
import { parentDefinition, parentFields, parentQuery } from "@/app/bo/parents/schema";

const [hasStudents, unlinked] = parentDefinition.table.views.builtIn;

test("PAP-1739 preserves DSA Table and typed count filter capability", () => {
  assert.equal(parentDefinition.table.identity.field, "name");
  assert.equal(parentQuery.filters.rules.length, 0, "All must not exclude unlinked Parents");
  assert.deepEqual(parentDefinition.table.filters.fields, ["studentCount"]);
  const count = parentFields.find(f => f.key === "studentCount");
  assert.equal(count?.type, "number");
  assert.equal(count?.capabilities.filter, true);
  assert.equal(parentDefinition.table.views.saved.kind, "local-ui");
});

test("PAP-1739 builtIn views are count-based and cover linked/unlinked without invented relationships", () => {
  assert.deepEqual(parentDefinition.table.views.builtIn.map(v => [v.id, v.label]), [
    ["has-students", "Có học viên"], ["unlinked", "Chưa liên kết"],
  ]);
  assert.deepEqual(hasStudents.state.filters, {
    logic: "AND", rules: [{ field: "studentCount", op: "gt", value: 0 }],
  });
  assert.deepEqual(unlinked.state.filters, {
    logic: "AND", rules: [{ field: "studentCount", op: "eq", value: 0 }],
  });
  for (const view of [hasStudents, unlinked]) {
    assert.equal(view.state.page, 1);
    assert.deepEqual(view.state.order, parentQuery.order);
    assert.deepEqual(view.state.visible, parentQuery.visible);
    assert.equal(view.state.search, "");
  }
});
