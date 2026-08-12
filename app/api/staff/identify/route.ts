import { NextResponse } from "next/server";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { getConfigBoolean } from "@/lib/repositories/web-config";

export const dynamic = "force-dynamic";

function normalizeMobile(value: string): string { return value.replace(/\D/g, ""); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mobile = normalizeMobile(url.searchParams.get("mobile") || "");
  if (!mobile) return NextResponse.json({ ok: false, error: "missing_mobile" }, { status: 400 });
  if (!(await getConfigBoolean("team_os_login_enabled", true))) return NextResponse.json({ ok: false, error: "login_disabled" }, { status: 503 });

  const staff = await staffByUsername(mobile);
  if (!staff) return NextResponse.json({ ok: false, error: "staff_not_found" }, { status: 404 });
  const activeOnly = await getConfigBoolean("team_os_login_active_staff_only", true);
  if (activeOnly && staff.employmentStatus !== "Active") return NextResponse.json({ ok: false, error: "inactive_staff" }, { status: 403 });

  return NextResponse.json({ ok: true, mobile, staff: { id: staff.id, name: staff.name, email: staff.email } }, { headers: { "Cache-Control": "no-store" } });
}
