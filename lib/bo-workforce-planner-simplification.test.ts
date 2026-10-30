import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const planner = readFileSync(new URL("../app/bo/components/workforce/BoWorkforceWeekPlanner.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("../app/bo/workforce/WorkforcePlanningView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/bo/bo.module.css", import.meta.url), "utf8");

test("PAP-1201 removes unnecessary planner noise without deleting assignment selection", () => {
  assert.doesNotMatch(planner, /weekPlannerSideHeading/);
  assert.doesNotMatch(view, /styles\.plannerLegend|Availability history|Ca nhân sự đã đăng ký\. Bạn có thể chọn ca khác|Tiếp tân áp dụng cho toàn ca|Phụ trách ca tại trung tâm/);
  assert.doesNotMatch(view, /<label className=\{styles\.field\}>Mẫu ca/);
  assert.doesNotMatch(css, /\.weekPlannerSideHeading|\.plannerLegend/);
  assert.match(view, /<select aria-label="Chọn ca để phân công" value=\{templateId\}/);
  assert.match(view, /setTemplateId\(event\.target\.value\)/);
  assert.match(view, /!templateId/);
});

test("PAP-1201 shows localized availability cancellation but retains the audited void operation", () => {
  assert.match(view, /: "Hủy xếp ca"\}\<\/button>/);
  assert.match(view, /onClick=\{\(\) => void voidAvailability\(item\.id\)\}/);
  assert.match(view, /Lý do hủy xếp ca/);
  assert.doesNotMatch(view, /"Void availability"/);
});
