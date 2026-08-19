import { NextRequest, NextResponse } from "next/server";

type TVMode = "ambient" | "arrival" | "choice" | "ritual" | "departure" | "news";
type TVSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
};

type RelayEvent = {
  id: number;
  surfaceId: string;
  kind: "play" | "control";
  mode?: "arrival" | "departure";
  replay?: boolean;
  subject?: TVSubject;
  action?: "ambient";
  status: "queued" | "delivered" | "expired";
  createdAt: number;
  expiresAt: number;
};

type SurfaceState = {
  surfaceId: string;
  mode: TVMode;
  lastSeenAt: number;
};

type RelayStore = {
  seq: number;
  events: RelayEvent[];
  surfaces: Record<string, SurfaceState>;
};

declare global {
  // eslint-disable-next-line no-var
  var __pinoriaPrototypeTvRelay: RelayStore | undefined;
}

const store = globalThis.__pinoriaPrototypeTvRelay ?? {
  seq: 0,
  events: [],
  surfaces: {},
};
globalThis.__pinoriaPrototypeTvRelay = store;

function expireOldEvents(now: number) {
  for (const event of store.events) {
    if (event.status === "queued" && event.expiresAt <= now) event.status = "expired";
  }
  store.events = store.events.filter((event) => now - event.createdAt < 60 * 60 * 1000);
}

function surfaceSnapshot(surfaceId: string, now: number) {
  const surface = store.surfaces[surfaceId];
  return {
    surfaceId,
    online: !!surface && now - surface.lastSeenAt < 6500,
    mode: surface?.mode ?? "ambient",
    lastSeenAt: surface?.lastSeenAt ?? null,
    queuedCount: store.events.filter((event) => event.surfaceId === surfaceId && event.status === "queued").length,
  };
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  expireOldEvents(now);
  const surfaceId = request.nextUrl.searchParams.get("surfaceId") || "RECEPTION_TV";
  const includeEvent = request.nextUrl.searchParams.get("includeEvent") === "1";
  const event = includeEvent
    ? store.events.find((item) => item.surfaceId === surfaceId && item.status === "queued") ?? null
    : null;

  return NextResponse.json({
    surface: surfaceSnapshot(surfaceId, now),
    event,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  expireOldEvents(now);
  const body = await request.json().catch(() => ({}));
  const surfaceId = typeof body.surfaceId === "string" ? body.surfaceId : "RECEPTION_TV";

  if (body.op === "heartbeat") {
    const mode: TVMode = body.mode ?? "ambient";
    store.surfaces[surfaceId] = { surfaceId, mode, lastSeenAt: now };
    return NextResponse.json({ ok: true, surface: surfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "enqueue-play") {
    const event: RelayEvent = {
      id: ++store.seq,
      surfaceId,
      kind: "play",
      mode: body.mode === "departure" ? "departure" : "arrival",
      replay: !!body.replay,
      subject: body.subject,
      status: "queued",
      createdAt: now,
      expiresAt: now + (body.replay ? 5 : 15) * 60 * 1000,
    };
    store.events.push(event);
    return NextResponse.json({ ok: true, event, surface: surfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "enqueue-control") {
    const event: RelayEvent = {
      id: ++store.seq,
      surfaceId,
      kind: "control",
      action: "ambient",
      status: "queued",
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
    };
    store.events.push(event);
    return NextResponse.json({ ok: true, event, surface: surfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "ack") {
    const id = Number(body.id);
    const event = store.events.find((item) => item.id === id && item.surfaceId === surfaceId);
    if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    if (event.status === "queued") event.status = "delivered";
    return NextResponse.json({ ok: true, event, surface: surfaceSnapshot(surfaceId, now) });
  }

  return NextResponse.json({ ok: false, error: "UNSUPPORTED_OPERATION" }, { status: 400 });
}
