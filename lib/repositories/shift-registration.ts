import { dbId, getPage, notion, queryAll } from "@/lib/notion";
import { relationIds, selectProp, textProp } from "@/lib/notion/properties";
import { mapShift, type Shift } from "@/lib/domain/shift";
import type { Staff } from "@/lib/domain/staff";
import { SCHEDULE_DAYS } from "@/lib/domain/staff-schedule";
import type { NotionPage } from "@/lib/notion/types";

const TZ = "Asia/Ho_Chi_Minh";
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type Week = { id: string; name: string; start: string; end: string };
export type ShiftRegistration = {
  id: string;
  weekId: string;
  weekName: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  editable: boolean;
  shifts: Record<string, Shift[]>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function formulaDate(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  const formula = record(property?.formula);
  const date = record(formula?.date);
  if (typeof date?.start === "string") return date.start.slice(0, 10);
  const string = formula?.string;
  if (typeof string === "string") {
    const iso = string.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) return iso;
    const dmY = string.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmY) return `${dmY[3]}-${dmY[2]}-${dmY[1]}`;
  }
  return "";
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function localDateParts(): { date: string; weekday: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return { date, weekday: weekdayMap[get("weekday")] ?? 0 };
}

export function registrationWindow(): { open: boolean; readonly: boolean; targetMonday: string } {
  const { date, weekday } = localDateParts();
  const daysUntilMonday = weekday === 6 ? 2 : weekday === 0 ? 1 : 8 - weekday;
  const targetMonday = addDays(date, daysUntilMonday);
  const open = weekday === 6 || weekday === 0;
  return { open, readonly: false, targetMonday };
}

async function findNextWeek(targetMonday: string): Promise<Week | null> {
  const pages = await queryAll(dbId("NOTION_WEEK_DB_ID"));
  const candidates = await Promise.all(pages.map(async (page) => {
    try {
      const full = await getPage(page.id);
      const start = formulaDate(full, "Monday Start on");
      if (start !== targetMonday) return null;
      return { id: full.id, name: textProp(full, "Name"), start, end: formulaDate(full, "Saturday Date") || addDays(start, 6) };
    } catch {
      return null;
    }
  }));
  return candidates.find((candidate): candidate is Week => Boolean(candidate)) ?? null;
}

async function activeShifts(): Promise<Shift[]> {
  const pages = await queryAll(dbId("NOTION_SHIFT_MASTER_DB_ID"));
  return pages.map(mapShift).filter((shift) => shift.active);
}

function registrationFromPage(page: NotionPage, week: Week, shifts: Shift[], editable: boolean): ShiftRegistration {
  const byId = new Map(shifts.map((shift) => [shift.id, shift]));
  const shiftMap = Object.fromEntries(DAY_NAMES.map((day) => [day, relationIds(page, `${day} Shifts`).map((id) => byId.get(id)).filter((shift): shift is Shift => Boolean(shift))]));
  return { id: page.id, weekId: week.id, weekName: week.name, weekStart: week.start, weekEnd: week.end, status: selectProp(page, "Schedule Status"), editable, shifts: shiftMap };
}

async function existingRegistration(staff: Staff, week: Week): Promise<NotionPage | null> {
  const pages = await queryAll(dbId("NOTION_SCHEDULE_DB_ID"));
  return pages.find((page) => relationIds(page, "Staff")[0] === staff.id && relationIds(page, "Week")[0] === week.id) ?? null;
}

export async function getShiftRegistration(staff: Staff): Promise<ShiftRegistration | null> {
  const window = registrationWindow();
  if (!window.open) return null;
  const week = await findNextWeek(window.targetMonday);
  if (!week) return null;
  const shifts = await activeShifts();
  const page = await existingRegistration(staff, week);
  if (!page) {
    return { id: "", weekId: week.id, weekName: week.name, weekStart: week.start, weekEnd: week.end, status: "Draft", editable: true, shifts: Object.fromEntries(DAY_NAMES.map((day) => [day, []])) };
  }
  return registrationFromPage(page, week, shifts, ["Draft", "Submitted"].includes(selectProp(page, "Schedule Status")));
}

function relationProperty(ids: string[]) {
  return ids;
}

export async function saveShiftRegistration(staff: Staff, weekId: string, selected: Record<string, string[]>): Promise<ShiftRegistration> {
  const window = registrationWindow();
  if (!window.open) throw new Error("REGISTRATION_CLOSED");
  const weekPages = await queryAll(dbId("NOTION_WEEK_DB_ID"));
  const weekPage = weekPages.find((page) => page.id === weekId);
  if (!weekPage) throw new Error("INVALID_WEEK");
  const fullWeek = await getPage(weekId);
  const start = formulaDate(fullWeek, "Monday Start on");
  if (start !== window.targetMonday) throw new Error("INVALID_WEEK");
  const week: Week = { id: weekId, name: textProp(fullWeek, "Name"), start, end: formulaDate(fullWeek, "Saturday Date") || addDays(start, 6) };
  const shifts = await activeShifts();
  const validIds = new Set(shifts.map((shift) => shift.id));
  const props: Record<string, unknown> = { "Schedule Status": { select: { name: "Draft" } } };
  for (const [day] of SCHEDULE_DAYS) {
    const ids = (selected[day] ?? []).filter((id) => validIds.has(id));
    props[`${day} Shifts`] = { relation: relationProperty(ids) };
  }
  const existing = await existingRegistration(staff, week);
  let pageId: string;
  if (existing) {
    const status = selectProp(existing, "Schedule Status");
    if (!["Draft", "Submitted"].includes(status)) throw new Error("REGISTRATION_LOCKED");
    await notion().pages.update({ page_id: existing.id, properties: props as never });
    pageId = existing.id;
  } else {
    const created = await notion().pages.create({ parent: { data_source_id: dbId("NOTION_SCHEDULE_DB_ID") }, properties: {
      Name: { title: [{ text: { content: `${staff.name} · ${week.name}` } }] },
      Staff: { relation: [{ id: staff.id }] },
      Week: { relation: [{ id: week.id }] },
      "Schedule Status": { select: { name: "Draft" } },
      ...Object.fromEntries(SCHEDULE_DAYS.map(([day]) => [`${day} Shifts`, { relation: [] }])),
    } as never });
    pageId = created.id;
    await notion().pages.update({ page_id: pageId, properties: props as never });
  }
  const fresh = await getPage(pageId);
  return registrationFromPage(fresh, week, shifts, true);
}

export async function submitShiftRegistration(staff: Staff, weekId: string): Promise<ShiftRegistration> {
  const window = registrationWindow();
  if (!window.open) throw new Error("REGISTRATION_CLOSED");
  const weekPages = await queryAll(dbId("NOTION_WEEK_DB_ID"));
  const weekPage = weekPages.find((page) => page.id === weekId);
  if (!weekPage) throw new Error("INVALID_WEEK");
  const fullWeek = await getPage(weekId);
  const start = formulaDate(fullWeek, "Monday Start on");
  if (start !== window.targetMonday) throw new Error("INVALID_WEEK");
  const week: Week = { id: weekId, name: textProp(fullWeek, "Name"), start, end: formulaDate(fullWeek, "Saturday Date") || addDays(start, 6) };
  const existing = await existingRegistration(staff, week);
  if (!existing) throw new Error("NO_REGISTRATION");
  const status = selectProp(existing, "Schedule Status");
  if (!["Draft", "Submitted"].includes(status)) throw new Error("REGISTRATION_LOCKED");
  await notion().pages.update({ page_id: existing.id, properties: { "Schedule Status": { select: { name: "Submitted" } } } as never });
  const fresh = await getPage(existing.id);
  return registrationFromPage(fresh, week, await activeShifts(), true);
}
