import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_PATH = path.join(
  process.cwd(),
  "app",
  "pinoria-tv",
  "ambient-house-motion-graph.saved.json",
);

function isValidGraph(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const graph = value as Record<string, unknown>;
  const canvas = graph.canvas as Record<string, unknown> | undefined;
  const mini = graph.miniCharacter as Record<string, unknown> | undefined;
  return (
    canvas?.width === 1920 &&
    canvas?.height === 1080 &&
    mini?.anchor === "center" &&
    Array.isArray(graph.horizontalLanes) &&
    Array.isArray(graph.rawConnectors)
  );
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false, error: "LOCAL_DEV_ONLY" },
      { status: 403 },
    );
  }

  let graph: unknown;
  try {
    graph = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isValidGraph(graph)) {
    return NextResponse.json({ ok: false, error: "INVALID_GRAPH" }, { status: 400 });
  }

  await writeFile(TARGET_PATH, `${JSON.stringify(graph, null, 2)}\n`, "utf8");

  return NextResponse.json({
    ok: true,
    path: "app/pinoria-tv/ambient-house-motion-graph.saved.json",
  });
}
