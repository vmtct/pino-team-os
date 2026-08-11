import { dbId, queryAll } from "@/lib/notion";
import { mapStaff, type Staff } from "@/lib/domain/staff";

export async function listStaff(): Promise<Staff[]> {
  const pages = await queryAll(dbId("NOTION_STAFF_DB_ID"));
  return pages.map(mapStaff);
}
