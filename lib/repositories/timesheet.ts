import { dbId, notion, queryAll } from "@/lib/notion";
import { relationIds, selectProp, textProp } from "@/lib/notion/properties";
import type { NotionPage } from "@/lib/notion/types";
import type { Staff } from "@/lib/domain/staff";

function latestForStaff(pages: NotionPage[], staffId: string): NotionPage | null {
  return pages
    .filter((page) => relationIds(page, "Staff").includes(staffId))
    .sort((a, b) => String((b as any).created_time || (b as any).createdTime || "").localeCompare(String((a as any).created_time || (a as any).createdTime || "")))[0] ?? null;
}

export async function latestTimesheet(staff: Staff): Promise<{ checkType: string; createdTime: string } | null> {
  const pages = await queryAll(dbId("NOTION_TIMESHEET_DB_ID"));
  const latest = latestForStaff(pages, staff.id);
  if (!latest) return null;
  return {
    checkType: selectProp(latest, "Check Type"),
    createdTime: String((latest as any).created_time || (latest as any).createdTime || ""),
  };
}

export async function createTimesheet(staff: Staff, checkType: "Check in" | "Check out", ipAddress: string): Promise<string> {
  const response = await notion().pages.create({
    parent: { data_source_id: await import("@/lib/notion").then(({ dataSourceId }) => dataSourceId(dbId("NOTION_TIMESHEET_DB_ID"))) },
    properties: {
      "Work Content": { title: [{ text: { content: `${checkType} — ${staff.name}` } }] },
      Staff: { relation: [{ id: staff.id }] },
      "Check Type": { select: { name: checkType } },
      "IP Address": { rich_text: [{ text: { content: ipAddress || "unknown" } }] },
    } as any,
  });
  return response.id;
}
