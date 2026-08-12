import { NextResponse } from "next/server";
import { authenticateCompanion, companionEnabled, createCompanionSession, COOKIE } from "@/lib/companion-auth";
import { getConfigValue } from "@/lib/repositories/web-config";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { hasCompanionAccess } from "@/lib/repositories/companion";

export const dynamic = "force-dynamic";

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 12 };

export async function POST(request: Request) {
  try {
    if (!(await companionEnabled())) return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
    const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!(await authenticateCompanion(username, password))) return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });

    const mobile = (await getConfigValue("companion_auth_staff_mobile", "")).replace(/\D/g, "");
    const staff = await staffByUsername(mobile);
    if (!staff || !hasCompanionAccess(staff)) return NextResponse.json({ ok: false, error: "staff_not_authorized" }, { status: 403 });

    const token = await createCompanionSession(mobile);
    const response = NextResponse.json({ ok: true, staff: { name: staff.name, mobile } });
    response.cookies.set(COOKIE, token, cookieOptions);
    return response;
  } catch (error) {
    console.error("[Companion Login] failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
