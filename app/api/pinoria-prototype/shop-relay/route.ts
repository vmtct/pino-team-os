import { NextRequest, NextResponse } from "next/server";
import type { ShopCategoryId, ShopPurchaseResult, ShopSessionSnapshot, ShopSubject } from "../../../pinoria-tv/shop-types";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";
const DEFAULT_SUBJECT: ShopSubject = { id: "bo", name: "Bơ", pls: 420 };
const VALID_CATEGORIES = new Set<ShopCategoryId>(["all", "hair", "face", "headwear", "eyewear", "back", "body", "prop"]);

const SUBJECT_STARTING_OWNED: Record<string, string[]> = {
  bo: ["asset_hologram_wings", "asset_painting_outfit_01", "asset_hair_01", "asset_face_01", "asset_birthday_hat", "asset_star_glasses"],
  tri: ["asset_piano_outfit_01", "asset_hair_01", "asset_face_02", "asset_conical_hat", "asset_party_glasses"],
  an: ["asset_hologram_wings", "asset_painting_outfit_02", "asset_hair_01", "asset_face_03", "asset_conical_hat"],
  mai: ["asset_base_body_01", "asset_hair_01", "asset_face_04", "asset_birthday_hat", "asset_party_glasses"],
};

type MutableShopSession = ShopSessionSnapshot & { purchaseSeq: number };
type ShopRelayStore = { sessions: Record<string, MutableShopSession> };

declare global {
  // eslint-disable-next-line no-var
  var __pinoriaPrototypeShopRelay: ShopRelayStore | undefined;
}

const store = globalThis.__pinoriaPrototypeShopRelay ?? { sessions: {} };
globalThis.__pinoriaPrototypeShopRelay = store;

function initialOwned(subjectId: string) {
  return [...(SUBJECT_STARTING_OWNED[subjectId] ?? [])];
}

function getSession(surfaceId: string): MutableShopSession {
  if (!store.sessions[surfaceId]) {
    store.sessions[surfaceId] = {
      surfaceId,
      open: false,
      subject: { ...DEFAULT_SUBJECT },
      category: "all",
      selectedAssetId: null,
      pendingPurchaseAssetId: null,
      ownedAssetIds: initialOwned(DEFAULT_SUBJECT.id),
      purchaseResult: null,
      updatedAt: Date.now(),
      purchaseSeq: 0,
    };
  }
  return store.sessions[surfaceId];
}

function snapshot(session: MutableShopSession): ShopSessionSnapshot {
  return {
    surfaceId: session.surfaceId,
    open: session.open,
    subject: { ...session.subject },
    category: session.category,
    selectedAssetId: session.selectedAssetId,
    pendingPurchaseAssetId: session.pendingPurchaseAssetId,
    ownedAssetIds: [...session.ownedAssetIds],
    purchaseResult: session.purchaseResult ? { ...session.purchaseResult } : null,
    updatedAt: session.updatedAt,
  };
}

function touch(session: MutableShopSession) {
  session.updatedAt = Date.now();
}

export async function GET(request: NextRequest) {
  const surfaceId = request.nextUrl.searchParams.get("surfaceId") || DEFAULT_SURFACE_ID;
  return NextResponse.json({ ok: true, session: snapshot(getSession(surfaceId)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const surfaceId = typeof body.surfaceId === "string" && body.surfaceId ? body.surfaceId : DEFAULT_SURFACE_ID;
  const session = getSession(surfaceId);

  if (body.op === "open") {
    session.open = true;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    if (body.subject && typeof body.subject.id === "string" && typeof body.subject.name === "string") {
      const nextId = body.subject.id;
      const changedSubject = nextId !== session.subject.id;
      session.subject = {
        id: nextId,
        name: body.subject.name,
        pls: Number.isFinite(Number(body.subject.pls)) ? Math.max(0, Math.round(Number(body.subject.pls))) : session.subject.pls,
      };
      if (changedSubject) {
        session.ownedAssetIds = initialOwned(nextId);
        session.selectedAssetId = null;
        session.category = "all";
      }
    }
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "close") {
    session.open = false;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "set-subject") {
    if (!body.subject || typeof body.subject.id !== "string" || typeof body.subject.name !== "string") {
      return NextResponse.json({ ok: false, error: "INVALID_SUBJECT" }, { status: 400 });
    }
    const nextId = body.subject.id;
    session.subject = {
      id: nextId,
      name: body.subject.name,
      pls: Number.isFinite(Number(body.subject.pls)) ? Math.max(0, Math.round(Number(body.subject.pls))) : 420,
    };
    session.ownedAssetIds = initialOwned(nextId);
    session.category = "all";
    session.selectedAssetId = null;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "set-category") {
    const category = body.category as ShopCategoryId;
    if (!VALID_CATEGORIES.has(category)) return NextResponse.json({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
    session.category = category;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "preview") {
    session.selectedAssetId = typeof body.assetId === "string" && body.assetId ? body.assetId : null;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "begin-purchase") {
    if (typeof body.assetId !== "string" || !body.assetId) return NextResponse.json({ ok: false, error: "INVALID_ASSET" }, { status: 400 });
    session.selectedAssetId = body.assetId;
    session.pendingPurchaseAssetId = body.assetId;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "cancel-purchase") {
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "confirm-purchase") {
    const assetId = typeof body.assetId === "string" ? body.assetId : session.pendingPurchaseAssetId;
    const price = Math.max(0, Math.round(Number(body.pricePls)));
    if (!assetId || !Number.isFinite(price)) return NextResponse.json({ ok: false, error: "INVALID_PURCHASE" }, { status: 400 });

    let status: ShopPurchaseResult["status"] = "purchased";
    if (session.ownedAssetIds.includes(assetId)) {
      status = "already-owned";
    } else if (session.subject.pls < price) {
      status = "insufficient-pls";
    } else {
      session.subject.pls -= price;
      session.ownedAssetIds.push(assetId);
    }

    session.purchaseResult = { id: ++session.purchaseSeq, assetId, status, at: Date.now() };
    session.pendingPurchaseAssetId = null;
    session.selectedAssetId = assetId;
    touch(session);
    return NextResponse.json({ ok: status === "purchased" || status === "already-owned", session: snapshot(session) });
  }

  return NextResponse.json({ ok: false, error: "UNSUPPORTED_OPERATION" }, { status: 400 });
}
