import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_PATH = path.join(
  process.cwd(),
  "app",
  "pinoria-tv",
  "ambient-house-emergence.saved.json",
);

function isValidSnapshot(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  const canvas = snapshot.canvas as Record<string, unknown> | undefined;
  const pin = snapshot.pin as Record<string, unknown> | undefined;
  return canvas?.width === 1920
    && canvas?.height === 1080
    && typeof pin?.laneId === "string"
    && typeof pin?.x === "number"
    && typeof pin?.y === "number";
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "LOCAL_DEV_ONLY" }, { status: 403 });
  }

  let snapshot: unknown;
  try {
    snapshot = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isValidSnapshot(snapshot)) {
    return NextResponse.json({ ok: false, error: "INVALID_EMERGENCE_PIN" }, { status: 400 });
  }

  await writeFile(TARGET_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return NextResponse.json({ ok: true, path: "app/pinoria-tv/ambient-house-emergence.saved.json" });
}
