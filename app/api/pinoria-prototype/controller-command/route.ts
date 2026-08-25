import { NextRequest, NextResponse } from "next/server";
import { isControllerLeaseOwner } from "../../../../lib/pinoria-prototype/controller-lease";
import { activateEnergySeed, markEnergySeedQueued } from "../../../../lib/pinoria-prototype/energy-seed";
import { isLearnerPresent, listHousePresence } from "../../../../lib/pinoria-prototype/house-presence";
import { resolvePinoriaStaff } from "../../../../lib/pinoria-prototype/staff-auth";
import type { LearningSpotlightPayload } from "../../../pinoria-tv/shop-types";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";

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

  if (body.op === "play-learning-spotlight") {
    const learnerId = typeof body.subject?.id === "string" ? body.subject.id : "";
    const learner = listHousePresence(surfaceId).find((item) => item.id === learnerId);
    if (!learner) return NextResponse.json({ ok: false, error: "LEARNER_NOT_CHECKED_IN" }, { status: 409 });
    const spotlight = parseLearningSpotlight(body.spotlight);
    if (!spotlight) return NextResponse.json({ ok: false, error: "INVALID_LEARNING_SPOTLIGHT" }, { status: 400 });

    // Learning truth is assumed to be committed upstream. This command only
    // projects that already-recorded milestone onto the shared House TV.
    const relayUrl = new URL("/api/pinoria-prototype/tv-relay", request.url);
    try {
      const relayResponse = await fetch(relayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "enqueue-play",
          surfaceId,
          mode: "learning",
          subject: learner,
          spotlight,
        }),
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
