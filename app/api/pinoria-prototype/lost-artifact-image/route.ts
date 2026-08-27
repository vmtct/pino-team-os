import { NextRequest, NextResponse } from "next/server";
import { getLostArtifact } from "../../../pinoria-tv/lost-artifact-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const artifact = getLostArtifact(id);
  if (!artifact) return NextResponse.json({ ok: false, error: "ARTIFACT_NOT_FOUND" }, { status: 404 });

  try {
    const upstream = await fetch(artifact.heroUrl, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8" },
      cf: { cacheEverything: true, cacheTtl: 86_400 },
    } as RequestInit);

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { ok: false, error: "ARTIFACT_IMAGE_UNAVAILABLE", upstreamStatus: upstream.status },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "ARTIFACT_IMAGE_FETCH_FAILED" }, { status: 502 });
  }
}
