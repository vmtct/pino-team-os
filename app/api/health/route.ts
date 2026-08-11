import { NextResponse } from "next";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "pino-team-os",
    timestamp: new Date().toISOString(),
  });
}
