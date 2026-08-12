import { NextResponse } from "next/server";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { getShiftRegistration, saveShiftRegistration, submitShiftRegistration } from "@/lib/repositories/shift-registration";

export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  const status = code === "REGISTRATION_CLOSED" ? 409 : code === "REGISTRATION_LOCKED" ? 409 : code === "INVALID_WEEK" ? 400 : 500;
  return NextResponse.json({ ok: false, error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("t")?.trim() ?? "";
  const staff = username ? await staffByUsername(username) : null;
  if (!staff) return NextResponse.json({ ok: false, error: "INVALID_STAFF" }, { status: 401 });
  try {
    const registration = await getShiftRegistration(staff);
    return NextResponse.json({ ok: true, registration }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; action?: "save" | "submit"; weekId?: string; selected?: Record<string, string[]> };
    const username = body.username?.trim() ?? "";
    const staff = username ? await staffByUsername(username) : null;
    if (!staff) return NextResponse.json({ ok: false, error: "INVALID_STAFF" }, { status: 401 });
    if (!body.weekId) return NextResponse.json({ ok: false, error: "INVALID_WEEK" }, { status: 400 });
    const registration = body.action === "submit"
      ? await submitShiftRegistration(staff, body.weekId)
      : await saveShiftRegistration(staff, body.weekId, body.selected ?? {});
    return NextResponse.json({ ok: true, registration }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
