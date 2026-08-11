import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "pino-team-os",
    timestamp: new Date().toISOString(),
  });
}
