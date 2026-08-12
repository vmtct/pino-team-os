import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyCompanionSession, COOKIE } from "@/lib/companion-auth";
import { createCompanionLog } from "@/lib/repositories/companion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get(COOKIE)?.value ?? "";
    if (!(await verifyCompanionSession(token))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null) as { masterId?: unknown; name?: unknown; marks?: unknown; fruit?: unknown } | null;
    const masterId = String(body?.masterId ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const marks = Array.isArray(body?.marks) ? body.marks.map(String).filter(Boolean).slice(0, 10) : [];
    const fruit = Number(body?.fruit ?? 0);
    if (!masterId || !name) return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    const pageId = await createCompanionLog(masterId, name, marks, Number.isFinite(fruit) ? fruit : 0);
    return NextResponse.json({ ok: true, pageId });
  } catch (error) {
    console.error("[Companion Log] failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
