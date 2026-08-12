import type { NotionPage } from "@/lib/notion/types";
import { relationIds, selectProp, textProp } from "@/lib/notion/properties";
import type { Shift } from "@/lib/domain/shift";

export const SCHEDULE_DAYS = [
  ["Monday", "Thứ 2"],
  ["Tuesday", "Thứ 3"],
  ["Wednesday", "Thứ 4"],
  ["Thursday", "Thứ 5"],
  ["Friday", "Thứ 6"],
  ["Saturday", "Thứ 7"],
  ["Sunday", "Chủ nhật"],
] as const;

export type StaffSchedule = {
  id: string;
  name: string;
  status: string;
  staffId: string;
  weekId: string;
  weekName: string;
  weekStart: string;
  weekEnd: string;
  note: string;
  shifts: Record<string, Shift[]>;
};

export function mapStaffSchedule(page: NotionPage, shiftsById: Map<string, Shift>, week: { name: string; start: string; end: string }): StaffSchedule {
  const shifts = Object.fromEntries(
    SCHEDULE_DAYS.map(([key]) => [key, relationIds(page, `${key} Shifts`).map((id) => shiftsById.get(id)).filter((shift): shift is Shift => Boolean(shift))]),
  );

  return {
    id: page.id,
    name: textProp(page, "Name"),
    status: selectProp(page, "Schedule Status"),
    staffId: relationIds(page, "Staff")[0] ?? "",
    weekId: relationIds(page, "Week")[0] ?? "",
    weekName: week.name,
    weekStart: week.start,
    weekEnd: week.end,
    note: textProp(page, "Staff Note"),
    shifts,
  };
}
