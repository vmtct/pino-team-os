import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_PATH = path.join(
  process.cwd(),
  "app",
  "pinoria-tv",
  "ambient-house-areas.saved.json",
);

const AREA_IDS = new Set(["reception", "artchitect", "little-piner", "pianohouse"]);

function isPoint(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return typeof point.x === "number" && Number.isFinite(point.x)
    && typeof point.y === "number" && Number.isFinite(point.y);
}

function isValidAreaSnapshot(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  const canvas = snapshot.canvas as Record<string, unknown> | undefined;
  if (canvas?.width !== 1920 || canvas?.height !== 1080) return false;
  if (!Array.isArray(snapshot.areas) || snapshot.areas.length !== 4) return false;

  const seen = new Set<string>();
  for (const rawArea of snapshot.areas) {
    if (!rawArea || typeof rawArea !== "object") return false;
    const area = rawArea as Record<string, unknown>;
    if (typeof area.id !== "string" || !AREA_IDS.has(area.id) || seen.has(area.id)) return false;
    if (typeof area.label !== "string") return false;
    if (!Array.isArray(area.points) || !area.points.every(isPoint)) return false;
    seen.add(area.id);
  }
  return seen.size === AREA_IDS.size;
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

  if (!isValidAreaSnapshot(snapshot)) {
    return NextResponse.json({ ok: false, error: "INVALID_AREA_SNAPSHOT" }, { status: 400 });
  }

  await writeFile(TARGET_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return NextResponse.json({
    ok: true,
    path: "app/pinoria-tv/ambient-house-areas.saved.json",
  });
}
