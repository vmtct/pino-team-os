import { dataSourceId, dbId, notion, queryAll } from "@/lib/notion";
import { relationIds, selectProp } from "@/lib/notion/properties";
import type { NotionPage } from "@/lib/notion/types";
import type { Staff } from "@/lib/domain/staff";

const FALLBACK_TIMESHEET_DB = "39f8156e-326f-807a-a745-cd7e936a144c";

function timesheetDbId(): string {
  return process.env.NOTION_TIMESHEET_DB_ID || FALLBACK_TIMESHEET_DB;
}

function createdAt(page: NotionPage): string { return String((page as any).created_time || (page as any).createdTime || ""); }

function latestForStaff(pages: NotionPage[], staffId: string): NotionPage | null {
  return pages.filter((page) => relationIds(page, "Staff").includes(staffId)).sort((a, b) => createdAt(b).localeCompare(createdAt(a)))[0] ?? null;
}

export async function latestTimesheet(staff: Staff): Promise<{ checkType: string; createdTime: string } | null> {
  const pages = await queryAll(timesheetDbId());
  const latest = latestForStaff(pages, staff.id);
  if (!latest) return null;
  return { checkType: selectProp(latest, "Check Type"), createdTime: createdAt(latest) };
}

export async function createTimesheet(staff: Staff, checkType: "Check in" | "Check out", ipAddress: string): Promise<string> {
  const response = await notion().pages.create({
    parent: { data_source_id: await dataSourceId(timesheetDbId()) },
    properties: {
      "Work Content": { title: [{ text: { content: `${checkType} — ${staff.name}` } }] },
      Staff: { relation: [{ id: staff.id }] },
      "Check Type": { select: { name: checkType } },
      "IP Address": { rich_text: [{ text: { content: ipAddress || "unknown" } }] },
    } as any,
  });
  return response.id;
}
