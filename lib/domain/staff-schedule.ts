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

function dayShiftCodes(page: NotionPage, day: string): string[] {
  const select = selectProp(page, day);
  if (select) return [select];
  const text = textProp(page, day).trim();
  return text ? [text] : [];
}

function dayShiftEntries(page: NotionPage, day: string, shiftsByKey: Map<string, Shift>): Shift[] {
  const keys = [...relationIds(page, `${day} Shifts`), ...relationIds(page, day), ...dayShiftCodes(page, day)];
  const seen = new Set<string>();
  const shifts: Shift[] = [];
  for (const key of keys) {
    const shift = shiftsByKey.get(key);
    if (!shift || seen.has(shift.id)) continue;
    seen.add(shift.id);
    shifts.push(shift);
  }
  return shifts;
}

export function mapStaffSchedule(page: NotionPage, shiftsByKey: Map<string, Shift>, week: { name: string; start: string; end: string }): StaffSchedule {
  const shifts = Object.fromEntries(
    SCHEDULE_DAYS.map(([key]) => [key, dayShiftEntries(page, key, shiftsByKey)]),
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
