import { describe, expect, it } from "node:test";
import { mapStaffSchedule } from "@/lib/domain/staff-schedule";

const shiftId = "3378156e-326f-80f3-ab64-dadd3539f868";
const schedule = {
  id: "3ba8156e-326f-801e-88fe-e7ac0b2f4c37",
  properties: {
    Name: { type: "title", title: [{ plain_text: "Văn Minh Trị" }] },
    "Week Status": { type: "select", select: { name: "Approved" } },
    Staff: { type: "relation", relation: [{ id: "30e8156e-326f-8147-a241-cd7b76a4c059" }] },
    Week: { type: "relation", relation: [{ id: "3658156e-326f-808b-a8fb-cd46b629a1bc" }] },
    "Monday Shifts": { type: "relation", relation: [] },
    "Wednesday Shifts": { type: "relation", relation: [{ id: shiftId }] },
    "Staff Note": { type: "rich_text", rich_text: [] },
  },
} as any;

const s2 = {
  id: shiftId,
  code: "S2",
  period: "Morning",
  startTime: "09:30",
  endTime: "11:30",
  active: true,
};

describe("Staff Schedule Notion schema", () => {
  it("resolves Wednesday relation to S2 09:30-11:30", () => {
    const result = mapStaffSchedule(schedule, new Map([[shiftId, s2]]), {
      name: "26B(11)",
      start: "2026-08-10T00:00:00.000Z",
      end: "2026-08-16T00:00:00.000Z",
    });

    expect(result.weekName).toBe("26B(11)");
    expect(result.weekStart).toBe("2026-08-10T00:00:00.000Z");
    expect(result.shifts.Wednesday).toHaveLength(1);
    expect(result.shifts.Wednesday[0]).toMatchObject({ code: "S2", startTime: "09:30", endTime: "11:30" });
  });
});
