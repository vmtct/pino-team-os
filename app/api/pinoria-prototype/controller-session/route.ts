import { NextRequest, NextResponse } from "next/server";
import {
  acquireControllerLease,
  controllerLeaseSnapshot,
  releaseControllerLease,
  renewControllerLease,
} from "../../../../lib/pinoria-prototype/controller-lease";
import { listHousePresence } from "../../../../lib/pinoria-prototype/house-presence";
import { resolvePinoriaStaff } from "../../../../lib/pinoria-prototype/staff-auth";
import { getSurfaceSessionSnapshot } from "../../../../lib/pinoria-prototype/surface-session";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";

async function auth(username: string) {
  try {
    return await resolvePinoriaStaff(username);
  } catch {
    return null;
  }
}

function snapshot(surfaceId: string, staffId: string, clientId: string) {
  const lease = controllerLeaseSnapshot(surfaceId);
  return {
    surface: getSurfaceSessionSnapshot(surfaceId),
    learners: listHousePresence(surfaceId),
    lease: lease ? {
      staffId: lease.staffId,
      staffName: lease.staffName,
      acquiredAt: lease.acquiredAt,
      renewedAt: lease.renewedAt,
      expiresAt: lease.expiresAt,
    } : null,
    isOwner: !!lease && lease.staffId === staffId && lease.clientId === clientId,
  };
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("t")?.trim() ?? "";
  const clientId = request.nextUrl.searchParams.get("clientId")?.trim() ?? "";
  const surfaceId = request.nextUrl.searchParams.get("surfaceId")?.trim() || DEFAULT_SURFACE_ID;
  const staff = await auth(username);
  if (!staff) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  return NextResponse.json({
    ok: true,
    staff: { id: staff.id, name: staff.name },
    ...snapshot(surfaceId, staff.id, clientId),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.t === "string" ? body.t.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const surfaceId = typeof body.surfaceId === "string" && body.surfaceId ? body.surfaceId : DEFAULT_SURFACE_ID;
  const staff = await auth(username);
  if (!staff) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (clientId.length < 8) return NextResponse.json({ ok: false, error: "INVALID_CLIENT" }, { status: 400 });

  if (body.op === "acquire") {
    const result = acquireControllerLease(surfaceId, staff, clientId);
    const state = snapshot(surfaceId, staff.id, clientId);
    return NextResponse.json({ ok: result.ok, staff: { id: staff.id, name: staff.name }, ...state }, { status: result.ok ? 200 : 409 });
  }

  if (body.op === "renew") {
    const result = renewControllerLease(surfaceId, staff, clientId);
    const state = snapshot(surfaceId, staff.id, clientId);
    return NextResponse.json({ ok: result.ok, staff: { id: staff.id, name: staff.name }, ...state }, { status: result.ok ? 200 : 409 });
  }

  if (body.op === "release") {
    const result = releaseControllerLease(surfaceId, staff, clientId);
    const state = snapshot(surfaceId, staff.id, clientId);
    return NextResponse.json({ ok: result.ok, staff: { id: staff.id, name: staff.name }, ...state }, { status: result.ok ? 200 : 409 });
  }

  return NextResponse.json({ ok: false, error: "UNSUPPORTED_OPERATION" }, { status: 400 });
}
