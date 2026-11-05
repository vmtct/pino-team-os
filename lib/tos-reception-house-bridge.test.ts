import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderV4 } from "./test-support/v4-render";

test("PAP-1239 hides unavailable reception mock list when a real Core House panel is supplied", async () => {
  const html = await renderV4("ReceptionV4Presentation", {
    centerName: "Cần Thơ",
    profileLabel: "Front Desk",
    shiftTime: "18:00 — 21:00",
    workDate: "2026-10-31",
    initialReadOnly: true,
    initialTab: "arrivals",
    visitLookup: "REAL_CORE_HOUSE_PANEL",
  });
  assert.match(html, /REAL_CORE_HOUSE_PANEL/);
  assert.doesNotMatch(html, /Chưa tải được danh sách đón \/ trả/);
  assert.doesNotMatch(html, /Tìm tên, lớp hoặc phòng/);
});

test("PAP-1239 TOS V4 uses canonical House path, not generic StudentVisit writer or ID-only lookup", () => {
  const entry = readFileSync("app/components/tos-vnext/TosVNextReception.tsx", "utf8");
  const api = readFileSync("lib/tos-reception-house-api.ts", "utf8");
  assert.match(entry, /ReceptionHouseCheckIn/);
  assert.doesNotMatch(entry, /Nhập ID học viên|tosDayOfLearningApi\.checkIn/);
  assert.match(api, /pinoria\/house\/check-in/);
  assert.doesNotMatch(api, /students\/.*visits\/open/);
});
