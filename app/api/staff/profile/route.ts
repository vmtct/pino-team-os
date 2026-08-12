import { NextResponse } from "next/server";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { missingStaffProfileFields, updateStaffProfile, type StaffProfile } from "@/lib/repositories/staff-profile";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<keyof StaffProfile>([
  "email", "dateOfBirth", "gender", "cccd", "idIssueDate", "idIssuePlace", "address", "employmentType", "department", "startDate", "role",
]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("t")?.trim() ?? "";
  if (!username) return NextResponse.json({ ok: false, error: "missing_username" }, { status: 400 });

  const staff = await staffByUsername(username);
  if (!staff) return NextResponse.json({ ok: false, error: "invalid_staff_link" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const input: Partial<StaffProfile> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!ALLOWED.has(key as keyof StaffProfile) || typeof value !== "string") continue;
    (input as Record<string, string>)[key] = value.trim();
  }

  const profile = await updateStaffProfile(staff, input);
  return NextResponse.json({ ok: true, profile, missing: missingStaffProfileFields(profile) });
}
