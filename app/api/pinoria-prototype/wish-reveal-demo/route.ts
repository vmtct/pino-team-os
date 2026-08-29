import { NextRequest, NextResponse } from "next/server";
import type { ClaimedWishReveal, WishRevealItem, WishRevealProjection, WishRevealPull } from "../../../pinoria-tv/wish-reveal-types";

// Prototype seam only. Production keeps this HTTP contract while the
// server-side implementation switches to pino-core PinoriaTvControlPlane.
// Compact cookie state keeps Founder review deterministic across Next workers.
type DemoVariant = "single" | "five" | "perfect";
type DemoRef = { revealId: string; drawId: string; variant: DemoVariant };
type DemoActive = DemoRef & { claimedAt: string };
type DemoState = {
  queue: DemoRef[];
  active: DemoActive | null;
  completedCount: number;
  lastCompleted: { revealId: string; completedAt: string } | null;
};

const EMPTY_STATE: DemoState = { queue: [], active: null, completedCount: 0, lastCompleted: null };

function cookieName(surfaceId: string) {
  return `pinoria_wish_demo_${surfaceId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
function readState(request: NextRequest, surfaceId: string): DemoState {
  const raw = request.cookies.get(cookieName(surfaceId))?.value;
  if (!raw) return structuredClone(EMPTY_STATE);
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<DemoState>;
    return {
      queue: Array.isArray(parsed.queue) ? parsed.queue as DemoRef[] : [],
      active: parsed.active ?? null,
      completedCount: Number.isInteger(parsed.completedCount) ? Number(parsed.completedCount) : 0,
      lastCompleted: parsed.lastCompleted ?? null,
    };
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

function readJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function json(body: unknown, state: DemoState, surfaceId: string, status = 200) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(cookieName(surfaceId), Buffer.from(JSON.stringify(state), "utf8").toString("base64url"), {
    path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60,
  });
  return response;
}
export async function GET(request: NextRequest) {
  const surfaceId = request.nextUrl.searchParams.get("surfaceId") || "RECEPTION_TV";
  const state = readState(request, surfaceId);
  return readJson({
    activeRevealId: state.active?.revealId ?? null,
    queuedCount: state.queue.length,
    completedCount: state.completedCount,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const surfaceId = typeof body.surfaceId === "string" ? body.surfaceId : "RECEPTION_TV";
  const state = readState(request, surfaceId);

  if (body.op === "claim") {
    const alreadyActive = state.active !== null;
    if (!state.active) {
      const next = state.queue.shift() ?? null;
      if (next) state.active = { ...next, claimedAt: new Date().toISOString() };
    }
    const reveal = state.active ? {
      projection: demoReveal(state.active.variant, state.active.revealId, state.active.drawId),
      claimedAt: state.active.claimedAt,
    } satisfies ClaimedWishReveal : null;
    return alreadyActive || !reveal ? readJson({ reveal }) : json({ reveal }, state, surfaceId);
  }
  if (body.op === "complete") {
    const revealId = typeof body.revealId === "string" ? body.revealId : "";
    if (state.lastCompleted?.revealId === revealId) {
      return readJson({ ok: true, revealId, completedAt: state.lastCompleted.completedAt });
    }
    if (!state.active || state.active.revealId !== revealId) {
      return readJson({ ok: false, error: "WISH_REVEAL_NOT_ACTIVE" }, 409);
    }
    const completedAt = new Date().toISOString();
    state.active = null;
    state.completedCount += 1;
    state.lastCompleted = { revealId, completedAt };
    return json({ ok: true, revealId, completedAt }, state, surfaceId);
  }

  if (body.op === "enqueue-demo") {
    const variant: DemoVariant = body.variant === "perfect" ? "perfect" : body.variant === "single" ? "single" : "five";
    const ref: DemoRef = { revealId: crypto.randomUUID(), drawId: crypto.randomUUID(), variant };
    state.queue.push(ref);
    return json({ ok: true, revealId: ref.revealId, queuedCount: state.queue.length }, state, surfaceId, 201);
  }

  if (body.op === "reset-demo") {
    return json({ ok: true }, structuredClone(EMPTY_STATE), surfaceId);
  }

  return readJson({ ok: false, error: "UNSUPPORTED_OPERATION" }, 400);
}

const signature: WishRevealItem[] = [
  item("aerin-crown", "Crown of Mist", "HEADWEAR", "MYTHIC", "https://assets.pinohouse.art/draft/Char_Birthday%20Hat.png"),
  item("aerin-wings", "Skyveil Wings", "WINGS", "MYTHIC", "https://assets.pinohouse.art/draft/Chat_Wing%20Hollogram.png"),
  item("aerin-robe", "Keeper Robe", "OUTFIT", "MYTHIC", "https://assets.pinohouse.art/draft/Char_body_painting_girl.png"),
];
const rareRobe = item("dew-mantle", "Dewdrop Mantle", "OUTFIT", "RARE", "https://assets.pinohouse.art/draft/Char_body_painting_girl.png");
const commonHat = item("cloud-pin", "Cloud Pin", "HEADWEAR", "COMMON", "https://assets.pinohouse.art/draft/Char_Birthday%20Hat.png");
const mythicWings = item("windglass-wings", "Windglass Wings", "WINGS", "MYTHIC", "https://assets.pinohouse.art/draft/Chat_Wing%20Hollogram.png");

function item(id: string, displayName: string, slot: WishRevealItem["slot"], rarity: WishRevealItem["rarity"], layerAssetKey: string): WishRevealItem {
  return { id, key: id, displayName, slot, rarity, layerAssetKey };
}

function pull(input: Partial<WishRevealPull> & Pick<WishRevealPull, "pullIndex" | "rarity" | "source" | "revealKind">): WishRevealPull {
  return {
    resonanceBefore: -1,
    resonanceAfter: -1,
    setProgressAfter: { owned: 0, total: 3 },
    wearables: [],
    variantIds: [],
    entitlementIds: [],
    ...input,
  };
}

function demoPulls(variant: "single" | "five" | "perfect"): WishRevealPull[] {
  if (variant === "perfect") return [pull({
    pullIndex: 1, rarity: "MYTHIC", source: "FEATURED", revealKind: "PERFECT_MEMORY",
    resonanceBefore: 0, resonanceAfter: 1, setProgressAfter: { owned: 3, total: 3 }, wearables: signature,
  })];
  const featured = pull({
    pullIndex: variant === "single" ? 1 : 5, rarity: "MYTHIC", source: "FEATURED", revealKind: "FEATURED_MEMORY",
    resonanceBefore: -1, resonanceAfter: 0, setProgressAfter: { owned: 1, total: 3 }, wearables: [signature[0]],
    entitlementIds: ["codex:aerin:fragment-01"],
  });
  if (variant === "single") return [featured];
  return [
    pull({ pullIndex: 1, rarity: "COMMON", source: "COMMON_POOL", revealKind: "WEARABLE", wearables: [commonHat] }),
    pull({ pullIndex: 2, rarity: "RARE", source: "RARE_POOL", revealKind: "WEARABLE", wearables: [rareRobe] }),
    pull({ pullIndex: 3, rarity: "COMMON", source: "COMMON_POOL", revealKind: "DUPLICATE" }),
    pull({ pullIndex: 4, rarity: "MYTHIC", source: "OFF_BANNER", revealKind: "WEARABLE", wearables: [mythicWings] }),
    featured,
  ];
}

function demoReveal(variant: "single" | "five" | "perfect", revealId: string, drawId: string): WishRevealProjection {
  return {
    schemaVersion: 1,
    revealId,
    drawId,
    centerId: "019c0000-0100-7000-8000-000000000001",
    visitId: "019c0000-0700-7000-8000-000000000007",
    subject: demoSubject(),
    banner: demoBanner(),
    pulls: demoPulls(variant),
  };
}
function demoSubject(): WishRevealProjection["subject"] {
  return {
    studentProfileId: "019c0000-0200-7000-8000-000000000002",
    displayName: "Bơ",
    character: {
      id: "019c0000-0300-7000-8000-000000000003",
      config: {
        hair: "https://assets.pinohouse.art/draft/Char_hair_girl_short.png",
        face: "https://assets.pinohouse.art/draft/Char_face_smiley.png",
        outfit: "https://assets.pinohouse.art/draft/Char_body_painting_girl.png",
        back: "https://assets.pinohouse.art/draft/Chat_Wing%20Hollogram.png",
      },
    },
  };
}

function demoBanner(): WishRevealProjection["banner"] {
  return {
    id: "019c0000-0400-7000-8000-000000000004",
    key: "aerin-sky-garden-v1",
    displayName: "Dư Âm của Aerin",
    storyHook: "Người Canh Giữ Khu Vườn Trên Mây vẫn để lại một lời hứa trong sương.",
    heroAssetKey: "pinoria/wish/aerin/hero/v001",
    regionKey: "sky-garden",
    bearer: { id: "019c0000-0500-7000-8000-000000000005", key: "aerin", displayName: "Aerin", title: "Người Canh Giữ Khu Vườn Trên Mây" },
    signatureSet: { id: "019c0000-0600-7000-8000-000000000006", key: "aerin-skykeeper", displayName: "Skykeeper Set", pieces: signature },
  };
}
