import { NextResponse } from "next/server";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { createTimesheet, latestTimesheet } from "@/lib/repositories/timesheet";
import { getConfigBoolean } from "@/lib/repositories/web-config";

export const dynamic = "force-dynamic";

function normalizeMobile(value: string): string { return value.replace(/\D/g, ""); }
function requestIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function resolveStaff(request: Request) {
  const url = new URL(request.url);
  const mobile = normalizeMobile(url.searchParams.get("t") || "");
  if (!mobile) return { staff: null, error: "missing_mobile" };
  const staff = await staffByUsername(mobile);
  if (!staff) return { staff: null, error: "staff_not_found" };
  if ((await getConfigBoolean("team_os_login_active_staff_only", true)) && staff.employmentStatus !== "Active") return { staff: null, error: "inactive_staff" };
  return { staff, error: "" };
}

export async function GET(request: Request) {
  const { staff, error } = await resolveStaff(request);
  if (!staff) return NextResponse.json({ ok: false, error }, { status: error === "inactive_staff" ? 403 : 404 });
  if (!(await getConfigBoolean("team_os_checkin_enabled", true))) return NextResponse.json({ ok: false, error: "checkin_disabled" }, { status: 503 });
  return NextResponse.json({ ok: true, staff: { id: staff.id, name: staff.name }, latest: await latestTimesheet(staff) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { staff, error } = await resolveStaff(request);
  if (!staff) return NextResponse.json({ ok: false, error }, { status: error === "inactive_staff" ? 403 : 404 });
  if (!(await getConfigBoolean("team_os_checkin_enabled", true))) return NextResponse.json({ ok: false, error: "checkin_disabled" }, { status: 503 });

  const body = await request.json().catch(() => null) as { checkType?: unknown } | null;
  const checkType = body?.checkType;
  if (checkType !== "Check in" && checkType !== "Check out") return NextResponse.json({ ok: false, error: "invalid_check_type" }, { status: 400 });

  const latest = await latestTimesheet(staff);
  if (checkType === "Check in" && latest?.checkType === "Check in") return NextResponse.json({ ok: false, error: "already_checked_in", latest }, { status: 409 });
  if (checkType === "Check out" && latest?.checkType !== "Check in") return NextResponse.json({ ok: false, error: "not_checked_in", latest }, { status: 409 });

  const ip = requestIp(request);
  const pageId = await createTimesheet(staff, checkType, ip);
  return NextResponse.json({ ok: true, pageId, checkType, ipLogged: await getConfigBoolean("team_os_checkin_ip_logging_enabled", true) }, { headers: { "Cache-Control": "no-store" } });
}
