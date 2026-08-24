import { NextRequest, NextResponse } from "next/server";
import { getSurfaceSessionSnapshot } from "../../../../lib/pinoria-prototype/surface-session";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";

export async function GET(request: NextRequest) {
  const surfaceId = request.nextUrl.searchParams.get("surfaceId") || DEFAULT_SURFACE_ID;
  return NextResponse.json(
    { ok: true, surface: getSurfaceSessionSnapshot(surfaceId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
