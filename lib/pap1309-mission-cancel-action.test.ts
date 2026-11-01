import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TddRenderer } from "../app/components/workspace-renderer/Renderer";
import { assignmentDefinition, assignmentFields } from "../app/bo/missions/schema";
import { TddRegistry, type TddActionBindings } from "./workspace-schema";

/** PAP-1309: a danger-only cancel form must not be misreported as permission denied. */
test("PAP-1309: authorized Mission Cancel renders confirmation, never submits on open", () => {
  const registry = new TddRegistry();
  const schema = registry.register({
    ...assignmentDefinition,
    data: {
      id: "pap1309-test-only",
      list: async () => ({ rows: [], total: 0 }),
      detail: async () => null,
    },
  });
  let submitted = 0;
  const bindings: TddActionBindings = {
    cancelEdit: { kind: "navigation", run: () => {} },
    saveEdit: { kind: "mutation", visible: false, run: () => { submitted++; } },
    confirmCancel: { kind: "mutation", visible: true, run: () => { submitted++; } },
  };
  const context = {
    surface: "BO" as const,
    centerId: "01900000-0000-7000-8000-000000000001",
    authorize: (permission: string) => permission === "student.mission_assignment.view" ||
      permission === "student.mission_assignment.manage",
  };
  const makeForm = (props: Partial<typeof context> = {}, recordId = "01900000-0000-7000-8000-000000000002",
    actionBindings = bindings) => renderToStaticMarkup(h(TddRenderer<typeof assignmentFields>, {
      view: { kind: "form" as const, props: {
        registry, schema, context: { ...context, ...props }, mode: "edit" as const,
        recordId, title: "Hủy giao Nhiệm vụ",
        content: h("p", null, "Lý do hủy là bắt buộc"), onClose: () => {}, actionBindings,
      } },
    }));
  const rendered = makeForm();
  assert.match(rendered, /Hủy giao Nhiệm vụ/);
  assert.match(rendered, /Xác nhận hủy/);
  assert.match(rendered, /Lý do hủy là bắt buộc/);
  assert.doesNotMatch(rendered, /Không có quyền xem bản ghi/);
  assert.doesNotMatch(rendered, />Lưu</);
  assert.equal(submitted, 0, "opening a confirmation never mutates data");

  assert.match(makeForm({ authorize: p => p === "student.mission_assignment.view" }), /Không có quyền xem bản ghi/);
  assert.doesNotMatch(makeForm({ authorize: p => p === "student.mission_assignment.view" }), /Xác nhận hủy/);
  assert.match(makeForm({}, ""), /Không có quyền xem bản ghi/);
  assert.match(makeForm({}, undefined as unknown as string, {
    ...bindings, confirmCancel: { ...bindings.confirmCancel!, visible: false },
  }), /Không có quyền xem bản ghi/);
});
