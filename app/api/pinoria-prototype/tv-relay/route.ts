import { NextRequest, NextResponse } from "next/server";
import { markHouseArrival, markHouseDeparture } from "../../../../lib/pinoria-prototype/house-presence";
import {
  closeSurfaceInteractive,
  getSurfaceSessionSnapshot,
  heartbeatSurface,
  setSurfaceSubject,
} from "../../../../lib/pinoria-prototype/surface-session";
import type { EnergySeedReward, LearningSpotlightPayload, PinoriaSurfaceBaseMode, WorldBroadcastPayload } from "../../../pinoria-tv/shop-types";

type TVMode = PinoriaSurfaceBaseMode;
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
  mode?: "arrival" | "departure" | "reward" | "learning" | "broadcast";
  replay?: boolean;
  subject?: TVSubject;
  reward?: EnergySeedReward;
  spotlight?: LearningSpotlightPayload;
  broadcast?: WorldBroadcastPayload;
  action?: "ambient";
  status: "queued" | "claimed" | "completed" | "expired";
  createdAt: number;
  expiresAt: number;
  claimedAt?: number;
  completedAt?: number;
};

type RelayStore = {
  seq: number;
  events: RelayEvent[];
};

declare global {
  // eslint-disable-next-line no-var
  var __pinoriaPrototypeTvRelay: (RelayStore & { surfaces?: Record<string, unknown> }) | undefined;
}

const store = globalThis.__pinoriaPrototypeTvRelay ?? {
  seq: 0,
  events: [],
};
globalThis.__pinoriaPrototypeTvRelay = store;

const CLAIM_LEASE_MS = 30_000;

function expireOldEvents(now: number) {
  for (const event of store.events) {
    if (event.status === "queued" && event.expiresAt <= now) {
      event.status = "expired";
      continue;
    }

    if (event.status === "claimed" && event.claimedAt && now - event.claimedAt > CLAIM_LEASE_MS) {
      if (event.expiresAt > now) {
        event.status = "queued";
        delete event.claimedAt;
      } else {
        event.status = "expired";
      }
    }
  }
  store.events = store.events.filter((event) => now - event.createdAt < 60 * 60 * 1000);
}

function activeEventFor(surfaceId: string) {
  return store.events.find((event) => event.surfaceId === surfaceId && event.status === "claimed") ?? null;
}

function nextQueuedEventFor(surfaceId: string) {
  const queued = store.events.filter((event) => event.surfaceId === surfaceId && event.status === "queued");
  // Shared-surface priority: Presence always wins. World Broadcast is the next
  // House-wide takeover. Learner reward/learning projections follow after it.
  return queued.find((event) => event.kind === "play" && (event.mode === "arrival" || event.mode === "departure"))
    ?? queued.find((event) => event.kind === "play" && event.mode === "broadcast")
    ?? queued[0]
    ?? null;
}

function relaySurfaceSnapshot(surfaceId: string, now: number) {
  const surface = getSurfaceSessionSnapshot(surfaceId, now);
  const active = activeEventFor(surfaceId);
  return {
    ...surface,
    mode: surface.baseMode,
    queuedCount: store.events.filter((event) => event.surfaceId === surfaceId && event.status === "queued").length,
    activeEvent: active ? {
      id: active.id,
      kind: active.kind,
      mode: active.mode ?? null,
      subjectId: active.subject?.id ?? null,
      subjectName: active.subject?.name ?? null,
    } : null,
  };
}

function parseSubject(value: unknown): { id: string; name: string } | null {
  if (!value || typeof value !== "object") return null;
  const subject = value as { id?: unknown; name?: unknown };
  if (typeof subject.id !== "string" || typeof subject.name !== "string") return null;
  return { id: subject.id, name: subject.name };
}

function applyPresenceOnClaim(event: RelayEvent, now: number) {
  if (event.replay || event.kind !== "play" || event.mode !== "arrival" || !event.subject) return;
  markHouseArrival(event.surfaceId, event.subject, now);
}

function applyPresenceOnComplete(event: RelayEvent) {
  if (event.replay || event.kind !== "play" || event.mode !== "departure" || !event.subject) return;
  const surface = getSurfaceSessionSnapshot(event.surfaceId);
  if (surface.interactive?.subjectId === event.subject.id) closeSurfaceInteractive(event.surfaceId);
  markHouseDeparture(event.surfaceId, event.subject.id);
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  expireOldEvents(now);
  const surfaceId = request.nextUrl.searchParams.get("surfaceId") || "RECEPTION_TV";
  const includeEvent = request.nextUrl.searchParams.get("includeEvent") === "1";
  const event = includeEvent && !activeEventFor(surfaceId)
    ? nextQueuedEventFor(surfaceId)
    : null;

  return NextResponse.json({
    surface: relaySurfaceSnapshot(surfaceId, now),
    event,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  expireOldEvents(now);
  const body = await request.json().catch(() => ({}));
  const surfaceId = typeof body.surfaceId === "string" ? body.surfaceId : "RECEPTION_TV";

  if (body.op === "heartbeat") {
    const mode: TVMode = body.mode === "arrival"
      || body.mode === "choice"
      || body.mode === "ritual"
      || body.mode === "reward"
      || body.mode === "learning"
      || body.mode === "broadcast"
      || body.mode === "departure"
      || body.mode === "news"
      ? body.mode
      : "ambient";
    heartbeatSurface({
      surfaceId,
      mode,
      subject: parseSubject(body.subject),
      now,
    });
    return NextResponse.json({ ok: true, surface: relaySurfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "enqueue-play") {
    const mode: RelayEvent["mode"] = body.mode === "departure"
      ? "departure"
      : body.mode === "reward"
        ? "reward"
        : body.mode === "learning"
          ? "learning"
          : body.mode === "broadcast"
            ? "broadcast"
            : "arrival";
    const event: RelayEvent = {
      id: ++store.seq,
      surfaceId,
      kind: "play",
      mode,
      replay: !!body.replay,
      subject: mode === "broadcast" ? undefined : body.subject,
      reward: mode === "reward" && body.reward && typeof body.reward === "object"
        ? body.reward as EnergySeedReward
        : undefined,
      spotlight: mode === "learning" && body.spotlight && typeof body.spotlight === "object"
        ? body.spotlight as LearningSpotlightPayload
        : undefined,
      broadcast: mode === "broadcast" && body.broadcast && typeof body.broadcast === "object"
        ? body.broadcast as WorldBroadcastPayload
        : undefined,
      status: "queued",
      createdAt: now,
      expiresAt: now + (body.replay ? 5 : 15) * 60 * 1000,
    };
    store.events.push(event);
    return NextResponse.json({ ok: true, event, surface: relaySurfaceSnapshot(surfaceId, now) });
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
    return NextResponse.json({ ok: true, event, surface: relaySurfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "claim") {
    const id = Number(body.id);
    const event = store.events.find((item) => item.id === id && item.surfaceId === surfaceId);
    if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    if (event.status !== "queued") {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_QUEUED", event }, { status: 409 });
    }
    if (activeEventFor(surfaceId)) {
      return NextResponse.json({ ok: false, error: "SURFACE_BUSY" }, { status: 409 });
    }
    event.status = "claimed";
    event.claimedAt = now;
    // Broadcast is world-owned, not learner-owned, so it must never replace
    // the current subject or invalidate a learner's suspended Shop/Inventory.
    if (event.subject) setSurfaceSubject(surfaceId, event.subject, now);
    applyPresenceOnClaim(event, now);
    return NextResponse.json({ ok: true, event, surface: relaySurfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "complete") {
    const id = Number(body.id);
    const event = store.events.find((item) => item.id === id && item.surfaceId === surfaceId);
    if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    if (event.status === "claimed") {
      event.status = "completed";
      event.completedAt = now;
      applyPresenceOnComplete(event);
    }
    return NextResponse.json({ ok: true, event, surface: relaySurfaceSnapshot(surfaceId, now) });
  }

  if (body.op === "ack") {
    const id = Number(body.id);
    const event = store.events.find((item) => item.id === id && item.surfaceId === surfaceId);
    if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    if (event.status === "queued" && !activeEventFor(surfaceId)) {
      event.status = "claimed";
      event.claimedAt = now;
      if (event.subject) setSurfaceSubject(surfaceId, event.subject, now);
      applyPresenceOnClaim(event, now);
    }
    return NextResponse.json({ ok: true, event, surface: relaySurfaceSnapshot(surfaceId, now) });
  }

  return NextResponse.json({ ok: false, error: "UNSUPPORTED_OPERATION" }, { status: 400 });
}
