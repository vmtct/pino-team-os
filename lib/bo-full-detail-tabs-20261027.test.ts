import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoFullDetail } from "../app/bo/components/registration/BoFullDetail";
import type { BoModule, BoRecord } from "./bo-registration";

const definition: BoModule = {
  label: "Students",
  group: "SCHOOL",
  fields: [
    { key: "name", label: "Học viên", type: "text", icon: "Aa", w: 200 },
    { key: "id", label: "ID", type: "id", icon: "#", w: 120 },
    { key: "status", label: "Trạng thái", type: "select", icon: "▣", w: 150 },
  ],
};
const student: BoRecord = { id: "student-1", name: "QA Student", status: "ACTIVE" };

function tabs(moduleKey: string, enableStudentSubscriptions = false): string[] {
  const html = renderToStaticMarkup(createElement(BoFullDetail, {
    module: definition, moduleKey, record: student,
    onBack() {}, mobileMenu: null, enableStudentSubscriptions,
  }));
  const labels = [...html.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map(m => m[1]);
  assert.ok(labels.length > 0, "Full Detail must expose accessible tabs");
  assert.ok(!html.includes(">Chuyên Sâu</button>"));
  assert.ok(html.includes("QA Student"), "Existing record title must remain visible");
  return labels;
}

test("Student Full Detail uses Thông tin and preserves Subscription/History", () => {
  assert.deepEqual(tabs("students", true), ["Thông tin", "Subscription", "Lịch Sử"]);
});

test("Subscription Full Detail uses canonical Thông Tin and preserves Enrollment", () => {
  assert.deepEqual(tabs("subscriptions"), ["Thông Tin", "Enrollment", "Lịch Sử"]);
});

test("Payroll period Full Detail preserves Quyết Toán", () => {
  assert.deepEqual(tabs("payroll-periods"), ["Thông tin", "Quyết Toán", "Lịch Sử"]);
});

test("Staff Full Detail exposes private Thu nhập without legacy Chuyên Sâu", () => {
  assert.deepEqual(tabs("staffs"), ["Thông tin", "Thu nhập", "Lịch Sử"]);
  assert.deepEqual(tabs("students"), ["Thông tin", "Lịch Sử"]);
});
