import { NextRequest, NextResponse } from "next/server";

const ASSET_BASE = "https://assets.pinohouse.art/pinoria";
const ALLOWED = new Set([
  "lost-artifact-divider.png",
  "lost-artifact-frame-corner.png",
  "meta-artifact-id.png",
  "meta-classification.png",
  "meta-last-seen.png",
  "meta-origin.png",
  "power-rune-01.png",
  "power-rune-02.png",
  "power-rune-03.png",
  "section-history.png",
]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const asset = request.nextUrl.searchParams.get("asset") ?? "";
  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND" }, { status: 404 });
  }

  try {
    const upstream = await fetch(`${ASSET_BASE}/${asset}`, {
      headers: { Accept: "image/png,image/*,*/*;q=0.8" },
      cf: { cacheEverything: true, cacheTtl: 604_800 },
    } as RequestInit);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ ok: false, error: "ASSET_UNAVAILABLE" }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "ASSET_FETCH_FAILED" }, { status: 502 });
  }
}
