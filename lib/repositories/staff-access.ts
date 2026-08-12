import { dbId, queryAll } from "@/lib/notion";
import { textProp } from "@/lib/notion/properties";
import { mapStaff, type Staff } from "@/lib/domain/staff";

/** Resolves the bearer-style staff URL key stored in Notion Staff.Username. */
export async function staffByUsername(username: string): Promise<Staff | null> {
  const key = username.trim();
  if (!key) return null;

  const pages = await queryAll(dbId("NOTION_STAFF_DB_ID"));
  for (const page of pages) {
    if (textProp(page, "Username").trim() === key) return mapStaff(page);
  }
  return null;
}
