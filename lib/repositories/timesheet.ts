import { dataSourceId, notion, queryAll } from "@/lib/notion";
import { relationIds, selectProp, textProp, formulaValueProp } from "@/lib/notion/properties";
import type { NotionPage } from "@/lib/notion/types";
import type { Staff } from "@/lib/domain/staff";

// Verified directly against the PINO Notion workspace.
const TIMESHEET_DATABASE_ID = "39f8156e-326f-807a-a745-cd7e936a144c";

function createdAt(page: NotionPage): string { return String((page as any).created_time || (page as any).createdTime || ""); }

function latestForStaff(pages: NotionPage[], staffId: string): NotionPage | null {
  return pages.filter((page) => relationIds(page, "Staff").includes(staffId)).sort((a, b) => createdAt(b).localeCompare(createdAt(a)))[0] ?? null;
}

export async function latestTimesheet(staff: Staff): Promise<{ checkType: string; createdTime: string } | null> {
  const pages = await queryAll(TIMESHEET_DATABASE_ID);
  const latest = latestForStaff(pages, staff.id);
  if (!latest) return null;
  return { checkType: selectProp(latest, "Check Type"), createdTime: createdAt(latest) };
}

export async function listTimesheetsForStaff(staff: Staff): Promise<Array<{ id: string; checkType: string; createdTime: string; roundedTime: string; ipAddress: string; workContent: string }>> {
  const pages = await queryAll(TIMESHEET_DATABASE_ID);
  return pages
    .filter((page) => relationIds(page, "Staff").includes(staff.id))
    .sort((a, b) => {
      const ar = formulaValueProp(a, "Rounded Time") || createdAt(a);
      const br = formulaValueProp(b, "Rounded Time") || createdAt(b);
      return br.localeCompare(ar);
    })
    .map((page) => ({
      id: page.id,
      checkType: selectProp(page, "Check Type"),
      createdTime: createdAt(page),
      roundedTime: formulaValueProp(page, "Rounded Time"),
      ipAddress: textProp(page, "IP Address"),
      workContent: textProp(page, "Work Content"),
    }));
}

export async function createTimesheet(staff: Staff, checkType: "Check in" | "Check out", ipAddress: string): Promise<string> {
  const response = await notion().pages.create({
    parent: { data_source_id: await dataSourceId(TIMESHEET_DATABASE_ID) },
    properties: {
      "Work Content": { title: [{ text: { content: `${checkType} — ${staff.name}` } }] },
      Staff: { relation: [{ id: staff.id }] },
      "Check Type": { select: { name: checkType } },
      "IP Address": { rich_text: [{ text: { content: ipAddress || "unknown" } }] },
    } as any,
  });
  return response.id;
}
