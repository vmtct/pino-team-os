import { headers } from "next/headers";
import { staffByUsername } from "@/lib/repositories/staff-access";
import type { Staff } from "@/lib/domain/staff";

export async function currentStaff(): Promise<Staff | null> {
  const requestHeaders = await headers();
  const username = requestHeaders.get("x-pino-staff-username")?.trim() ?? "";
  if (!username) return null;
  return staffByUsername(username);
}
