import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("WFM-PLAN TOS availability keeps submission distinct from final assignment", async () => {
  const source = await read("app/components/WorkforceWorkspace.tsx");
  assert.match(source, /Đăng ký ca tuần/);
  assert.match(source, /Gửi cho Manager/);
  assert.match(source, /Đây chưa phải lịch làm việc chính thức/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /availability\?\.status === "SUBMITTED"/);
  assert.match(source, /workforceApi\.submitAvailability/);
  assert.doesNotMatch(source, /self-assign|assignWorkforceShift/);
});

test("WFM-PLAN BO uses inline governed reasons instead of browser prompts", async () => {
  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /Xác nhận & xếp ca/);
  assert.match(source, /Lý do thay đổi/);
  assert.match(source, /canonical assignment audit/);
  assert.match(
    source,
    /cancelWorkforceAssignment\(\s*assignment\.id,\s*cancellationReason/,
  );
  assert.match(
    source,
    /cancelWorkforceAssignment\(\s*assignment\.id,\s*correctionReason/,
  );
  assert.doesNotMatch(source, /prompt\(/);
});
