import { NextRequest, NextResponse } from "next/server";

const ASSETS = {
  back: "https://assets.pinohouse.art/draft/Back.png",
  mid: "https://assets.pinohouse.art/draft/Mid.png",
  front: "https://assets.pinohouse.art/draft/Front.png",
} as const;

type LayerName = keyof typeof ASSETS;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const layer = request.nextUrl.searchParams.get("layer") as LayerName | null;
  if (!layer || !(layer in ASSETS)) {
    return NextResponse.json({ ok: false, error: "INVALID_LAYER" }, { status: 400 });
  }

  const upstream = await fetch(ASSETS[layer], {
    cache: "no-store",
    headers: { Accept: "image/png" },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: "UPSTREAM_ASSET_FAILED", layer, status: upstream.status },
      { status: 502 },
    );
  }

  const bytes = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") || "image/png";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Pinoria-Ambient-Layer": layer,
      "X-Pinoria-Upstream-Content-Type": contentType,
    },
  });
}
