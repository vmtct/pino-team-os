import { NextRequest, NextResponse } from "next/server";
import { isControllerLeaseOwner } from "../../../../lib/pinoria-prototype/controller-lease";
import { activateEnergySeed, markEnergySeedQueued } from "../../../../lib/pinoria-prototype/energy-seed";
import { isLearnerPresent, listHousePresence } from "../../../../lib/pinoria-prototype/house-presence";
import { resolvePinoriaStaff } from "../../../../lib/pinoria-prototype/staff-auth";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";

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

  if ((body.op === "open" || body.op === "set-subject" || body.op === "activate-energy-seed") && body.subject?.id) {
    const learnerId = String(body.subject.id);
    if (!isLearnerPresent(surfaceId, learnerId)) {
      return NextResponse.json({ ok: false, error: "LEARNER_NOT_CHECKED_IN" }, { status: 409 });
    }
  }

  if (body.op === "activate-energy-seed") {
    const learnerId = typeof body.subject?.id === "string" ? body.subject.id : "";
    const learner = listHousePresence(surfaceId).find((item) => item.id === learnerId);
    if (!learner) return NextResponse.json({ ok: false, error: "LEARNER_NOT_CHECKED_IN" }, { status: 409 });

    // Prototype Core semantics: resolve + commit the reward before TV delivery.
    // A failed TV request must never reroll or grant a second reward.
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
