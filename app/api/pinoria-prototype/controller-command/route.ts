import { NextRequest, NextResponse } from "next/server";
import { isControllerLeaseOwner } from "../../../../lib/pinoria-prototype/controller-lease";
import { activateEnergySeed, markEnergySeedQueued } from "../../../../lib/pinoria-prototype/energy-seed";
import { isLearnerPresent, listHousePresence } from "../../../../lib/pinoria-prototype/house-presence";
import { resolvePinoriaStaff } from "../../../../lib/pinoria-prototype/staff-auth";
import { getSurfaceSessionSnapshot, setSurfaceWorldState } from "../../../../lib/pinoria-prototype/surface-session";
import type {
  LearningSpotlightPayload,
  PinoriaWorldStateSnapshot,
  WorldBroadcastPayload,
  WorldStateTransitionPayload,
} from "../../../pinoria-tv/shop-types";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";
const WORLD_THEMES = new Set(["neutral", "verdant", "tide", "terravia", "ember"]);

function parseLearningSpotlight(value: unknown): LearningSpotlightPayload | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<LearningSpotlightPayload>;
  const programs = new Set(["artchitect", "pianohouse", "little-piner", "toppi", "house"]);
  const kinds = new Set(["skill", "performance", "project", "achievement"]);
  if (
    typeof input.id !== "string"
    || !programs.has(String(input.program))
    || !kinds.has(String(input.kind))
    || typeof input.milestoneLabel !== "string"
    || typeof input.detail !== "string"
  ) return null;
  return {
    id: input.id,
    program: input.program!,
    kind: input.kind!,
    milestoneLabel: input.milestoneLabel,
    detail: input.detail,
    previousLabel: typeof input.previousLabel === "string" ? input.previousLabel : undefined,
    nextLabel: typeof input.nextLabel === "string" ? input.nextLabel : undefined,
    evidenceLabel: typeof input.evidenceLabel === "string" ? input.evidenceLabel : undefined,
  };
}

function parseWorldBroadcast(value: unknown): WorldBroadcastPayload | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<WorldBroadcastPayload>;
  const kinds = new Set(["world-update", "campaign", "discovery", "companion", "community"]);
  const scopes = new Set(["pinoria", "house"]);
  if (
    typeof input.id !== "string"
    || !kinds.has(String(input.kind))
    || !scopes.has(String(input.scope))
    || typeof input.eyebrow !== "string"
    || typeof input.title !== "string"
    || typeof input.detail !== "string"
  ) return null;
  return {
    id: input.id,
    kind: input.kind!,
    scope: input.scope!,
    eyebrow: input.eyebrow,
    title: input.title,
    detail: input.detail,
    regionLabel: typeof input.regionLabel === "string" ? input.regionLabel : undefined,
    chapterLabel: typeof input.chapterLabel === "string" ? input.chapterLabel : undefined,
    footer: typeof input.footer === "string" ? input.footer : undefined,
  };
}

function parseWorldState(value: unknown): PinoriaWorldStateSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PinoriaWorldStateSnapshot>;
  if (
    typeof input.id !== "string"
    || typeof input.regionLabel !== "string"
    || typeof input.chapterLabel !== "string"
    || typeof input.seasonLabel !== "string"
    || !WORLD_THEMES.has(String(input.ambientTheme))
  ) return null;
  return {
    id: input.id,
    revision: Number.isFinite(Number(input.revision)) ? Math.max(1, Math.round(Number(input.revision))) : 1,
    regionLabel: input.regionLabel,
    chapterLabel: input.chapterLabel,
    seasonLabel: input.seasonLabel,
    ambientTheme: input.ambientTheme!,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : 0,
  };
}

function parseWorldStateTransition(value: unknown): WorldStateTransitionPayload | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<WorldStateTransitionPayload>;
  const to = parseWorldState(input.to);
  if (
    typeof input.id !== "string"
    || typeof input.title !== "string"
    || typeof input.detail !== "string"
    || !to
  ) return null;
  // The caller's `from` value is presentation metadata only. Canonical `from`
  // is always replaced with the current committed state below.
  return {
    id: input.id,
    title: input.title,
    detail: input.detail,
    from: to,
    to,
    footer: typeof input.footer === "string" ? input.footer : undefined,
  };
}

async function projectRelay(request: NextRequest, body: Record<string, unknown>) {
  const relayUrl = new URL("/api/pinoria-prototype/tv-relay", request.url);
  try {
    const relayResponse = await fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await relayResponse.text();
    return new NextResponse(text, {
      status: relayResponse.status,
      headers: {
        "Content-Type": relayResponse.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "RELAY_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.staffToken === "string" ? body.staffToken.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const surfaceId = typeof body.surfaceId === "string" && body.surfaceId ? body.surfaceId : DEFAULT_SURFACE_ID;

  let staff = null;
  try {
    staff = await resolvePinoriaStaff(username);
  } catch {
    staff = null;
  }
  if (!staff) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!isControllerLeaseOwner(surfaceId, staff.id, clientId)) {
    return NextResponse.json({ ok: false, error: "CONTROLLER_LEASE_REQUIRED" }, { status: 409 });
  }

  if ((body.op === "open" || body.op === "set-subject" || body.op === "activate-energy-seed" || body.op === "play-learning-spotlight") && body.subject?.id) {
    const learnerId = String(body.subject.id);
    if (!isLearnerPresent(surfaceId, learnerId)) {
      return NextResponse.json({ ok: false, error: "LEARNER_NOT_CHECKED_IN" }, { status: 409 });
    }
  }

  if (body.op === "play-world-state-transition") {
    const parsed = parseWorldStateTransition(body.worldTransition);
    if (!parsed) return NextResponse.json({ ok: false, error: "INVALID_WORLD_STATE_TRANSITION" }, { status: 400 });

    const before = getSurfaceSessionSnapshot(surfaceId).worldState;
    // Commit the actual world mutation first. TV projection may be delayed,
    // replayed, or fail entirely; Ambient must still converge on this truth.
    const committedSurface = setSurfaceWorldState(surfaceId, parsed.to);
    const transition: WorldStateTransitionPayload = {
      ...parsed,
      from: before,
      to: committedSurface.worldState,
    };

    const relayUrl = new URL("/api/pinoria-prototype/tv-relay", request.url);
    try {
      const relayResponse = await fetch(relayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "enqueue-play",
          surfaceId,
          mode: "world-transition",
          worldTransition: transition,
        }),
        cache: "no-store",
      });
      const relayData = await relayResponse.json().catch(() => ({})) as { ok?: boolean; event?: unknown; error?: string };
      if (!relayResponse.ok || !relayData.ok) {
        return NextResponse.json({
          ok: false,
          error: "WORLD_STATE_COMMITTED_RELAY_UNAVAILABLE",
          worldState: committedSurface.worldState,
          transition,
        }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({
        ok: true,
        event: relayData.event,
        worldState: committedSurface.worldState,
        transition,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({
        ok: false,
        error: "WORLD_STATE_COMMITTED_RELAY_UNAVAILABLE",
        worldState: committedSurface.worldState,
        transition,
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (body.op === "play-world-broadcast") {
    const broadcast = parseWorldBroadcast(body.broadcast);
    if (!broadcast) return NextResponse.json({ ok: false, error: "INVALID_WORLD_BROADCAST" }, { status: 400 });

    // World Broadcast projects already-approved world truth. It is deliberately
    // subjectless so it suspends, but never steals, learner ownership on TV.
    return projectRelay(request, {
      op: "enqueue-play",
      surfaceId,
      mode: "broadcast",
      broadcast,
    });
  }

  if (body.op === "play-learning-spotlight") {
    const learnerId = typeof body.subject?.id === "string" ? body.subject.id : "";
    const learner = listHousePresence(surfaceId).find((item) => item.id === learnerId);
    if (!learner) return NextResponse.json({ ok: false, error: "LEARNER_NOT_CHECKED_IN" }, { status: 409 });
    const spotlight = parseLearningSpotlight(body.spotlight);
    if (!spotlight) return NextResponse.json({ ok: false, error: "INVALID_LEARNING_SPOTLIGHT" }, { status: 400 });

    return projectRelay(request, {
      op: "enqueue-play",
      surfaceId,
      mode: "learning",
      subject: learner,
      spotlight,
    });
  }

  if (body.op === "activate-energy-seed") {
    const learnerId = typeof body.subject?.id === "string" ? body.subject.id : "";
    const learner = listHousePresence(surfaceId).find((item) => item.id === learnerId);
    if (!learner) return NextResponse.json({ ok: false, error: "LEARNER_NOT_CHECKED_IN" }, { status: 409 });

    const activated = activateEnergySeed(surfaceId, learner, staff.id);
    if (!activated.ok) {
      return NextResponse.json({
        ok: false,
        error: "ENERGY_SEED_ALREADY_ACTIVATED",
        activation: activated.activation,
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const relayUrl = new URL("/api/pinoria-prototype/tv-relay", request.url);
    try {
      const relayResponse = await fetch(relayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "enqueue-play",
          surfaceId,
          mode: "reward",
          subject: learner,
          reward: activated.activation.reward,
        }),
        cache: "no-store",
      });
      const relayData = await relayResponse.json().catch(() => ({})) as { ok?: boolean; event?: { id?: number }; error?: string };
      if (!relayResponse.ok || !relayData.ok || !Number.isFinite(Number(relayData.event?.id))) {
        return NextResponse.json({
          ok: false,
          error: "REWARD_COMMITTED_RELAY_UNAVAILABLE",
          activation: activated.activation,
        }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      const activation = markEnergySeedQueued(surfaceId, learner.id, Number(relayData.event!.id));
      return NextResponse.json({ ok: true, activation, event: relayData.event }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({
        ok: false,
        error: "REWARD_COMMITTED_RELAY_UNAVAILABLE",
        activation: activated.activation,
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  const relayBody = { ...body } as Record<string, unknown>;
  delete relayBody.staffToken;
  delete relayBody.clientId;

  const relayUrl = new URL("/api/pinoria-prototype/shop-relay", request.url);
  try {
    const relayResponse = await fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(relayBody),
      cache: "no-store",
    });
    const text = await relayResponse.text();
    return new NextResponse(text, {
      status: relayResponse.status,
      headers: {
        "Content-Type": relayResponse.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "RELAY_UNAVAILABLE" }, { status: 503 });
  }
}
