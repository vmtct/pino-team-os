import { NextRequest, NextResponse } from "next/server";
import {
  closeSurfaceInteractive,
  getSurfaceSessionSnapshot,
  openSurfaceInteractive,
  setSurfaceInteractiveView,
} from "../../../../lib/pinoria-prototype/surface-session";
import {
  getCharacterProjection,
  grantCharacterAsset,
  setCharacterAchievement,
  setCharacterWearable,
} from "../../../../lib/pinoria-prototype/character-projection";
import type {
  InventoryAchievementSlot,
  InventoryEquipmentState,
  InventoryFilter,
  InventoryWearableSlot,
  PinoriaStoreView,
  ShopCategoryId,
  ShopPurchaseResult,
  ShopSessionSnapshot,
  ShopSubject,
} from "../../../pinoria-tv/shop-types";

const DEFAULT_SURFACE_ID = "RECEPTION_TV";
const DEFAULT_SUBJECT: ShopSubject = { id: "bo", name: "Bơ", pls: 420 };
const VALID_CATEGORIES = new Set<ShopCategoryId>(["all", "hair", "face", "headwear", "eyewear", "back", "body", "prop"]);
const VALID_VIEWS = new Set<PinoriaStoreView>(["shop", "inventory"]);
const VALID_INVENTORY_FILTERS = new Set<InventoryFilter>(["outfit", "accessory"]);
const VALID_WEARABLE_SLOTS = new Set<InventoryWearableSlot>(["back", "body", "hair", "face", "headwear", "eyewear"]);
const VALID_ACHIEVEMENT_SLOTS = new Set<InventoryAchievementSlot>([
  "achievement-1",
  "achievement-2",
  "achievement-3",
  "achievement-4",
  "achievement-5",
  "achievement-6",
  "achievement-7",
  "achievement-8",
]);

type MutableShopSession = ShopSessionSnapshot & { purchaseSeq: number };
type ShopRelayStore = { sessions: Record<string, MutableShopSession> };

declare global {
  var __pinoriaPrototypeShopRelay: ShopRelayStore | undefined;
}

const store = globalThis.__pinoriaPrototypeShopRelay ?? { sessions: {} };
globalThis.__pinoriaPrototypeShopRelay = store;

function syncSessionCharacter(session: MutableShopSession, subjectId = session.subject.id) {
  const projection = getCharacterProjection(subjectId);
  session.ownedAssetIds = [...projection.ownedAssetIds];
  session.earnedAchievementIds = [...projection.earnedAchievementIds];
  session.equipment = {
    wearables: { ...projection.equipment.wearables },
    achievements: { ...projection.equipment.achievements },
  };
}

function resetSubjectInventory(session: MutableShopSession, subjectId: string) {
  session.view = "shop";
  syncSessionCharacter(session, subjectId);
  session.inventoryFilter = "outfit";
  session.inventorySelectedId = null;
  session.selectedAssetId = null;
  session.category = "all";
}

function getSession(surfaceId: string): MutableShopSession {
  if (!store.sessions[surfaceId]) {
    const projection = getCharacterProjection(DEFAULT_SUBJECT.id);
    store.sessions[surfaceId] = {
      surfaceId,
      open: false,
      view: "shop",
      subject: { ...DEFAULT_SUBJECT },
      category: "all",
      selectedAssetId: null,
      pendingPurchaseAssetId: null,
      ownedAssetIds: [...projection.ownedAssetIds],
      earnedAchievementIds: [...projection.earnedAchievementIds],
      inventoryFilter: "outfit",
      inventorySelectedId: null,
      equipment: { wearables: { ...projection.equipment.wearables }, achievements: { ...projection.equipment.achievements } },
      purchaseResult: null,
      updatedAt: Date.now(),
      purchaseSeq: 0,
    };
  }

  // Backfill hot-reloaded prototype sessions created before the inventory view.
  const session = store.sessions[surfaceId];
  session.view ??= "shop";
  session.earnedAchievementIds ??= [];
  session.inventoryFilter ??= "outfit";
  session.inventorySelectedId ??= null;
  session.equipment ??= { wearables: {}, achievements: {} };
  session.equipment.wearables ??= {};
  session.equipment.achievements ??= {};

  // Migrate the original three prototype achievement slot keys in hot sessions.
  const legacyAchievements = session.equipment.achievements as Record<string, string | undefined>;
  if (legacyAchievements["artifact-1"] && !legacyAchievements["achievement-1"]) legacyAchievements["achievement-1"] = legacyAchievements["artifact-1"];
  if (legacyAchievements["artifact-2"] && !legacyAchievements["achievement-2"]) legacyAchievements["achievement-2"] = legacyAchievements["artifact-2"];
  if (legacyAchievements.badge && !legacyAchievements["achievement-3"]) legacyAchievements["achievement-3"] = legacyAchievements.badge;
  delete legacyAchievements["artifact-1"];
  delete legacyAchievements["artifact-2"];
  delete legacyAchievements.badge;
  for (const slot of VALID_ACHIEVEMENT_SLOTS) {
    if (session.equipment.achievements[slot]?.startsWith("badge-")) delete session.equipment.achievements[slot];
  }

  syncSessionCharacter(session);
  return session;
}

function snapshot(session: MutableShopSession): ShopSessionSnapshot {
  return {
    surfaceId: session.surfaceId,
    open: session.open,
    view: session.view,
    subject: { ...session.subject },
    category: session.category,
    selectedAssetId: session.selectedAssetId,
    pendingPurchaseAssetId: session.pendingPurchaseAssetId,
    ownedAssetIds: [...session.ownedAssetIds],
    earnedAchievementIds: [...session.earnedAchievementIds],
    inventoryFilter: session.inventoryFilter,
    inventorySelectedId: session.inventorySelectedId,
    equipment: {
      wearables: { ...session.equipment.wearables },
      achievements: { ...session.equipment.achievements },
    },
    purchaseResult: session.purchaseResult ? { ...session.purchaseResult } : null,
    updatedAt: session.updatedAt,
  };
}

function touch(session: MutableShopSession) {
  session.updatedAt = Date.now();
}

function reconcileSessionWithSurface(session: MutableShopSession) {
  const surface = getSurfaceSessionSnapshot(session.surfaceId);
  const interactive = surface.interactive;
  const ownsInteractive = !!interactive && interactive.subjectId === session.subject.id;

  if (!ownsInteractive) {
    if (session.open) {
      session.open = false;
      session.pendingPurchaseAssetId = null;
      session.purchaseResult = null;
      touch(session);
    }
    return surface;
  }

  if (!session.open || session.view !== interactive.view) {
    session.open = true;
    session.view = interactive.view;
    touch(session);
  }
  return surface;
}

function response(session: MutableShopSession, ok = true) {
  return NextResponse.json({
    ok,
    session: snapshot(session),
    surface: getSurfaceSessionSnapshot(session.surfaceId),
  });
}

export async function GET(request: NextRequest) {
  const surfaceId = request.nextUrl.searchParams.get("surfaceId") || DEFAULT_SURFACE_ID;
  const session = getSession(surfaceId);
  reconcileSessionWithSurface(session);
  return NextResponse.json(
    { ok: true, session: snapshot(session), surface: getSurfaceSessionSnapshot(surfaceId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const surfaceId = typeof body.surfaceId === "string" && body.surfaceId ? body.surfaceId : DEFAULT_SURFACE_ID;
  const session = getSession(surfaceId);
  reconcileSessionWithSurface(session);

  if (body.op === "open") {
    session.open = true;
    session.view = "shop";
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
      if (changedSubject) resetSubjectInventory(session, nextId);
    }
    openSurfaceInteractive(surfaceId, session.subject, "shop");
    touch(session);
    return response(session);
  }

  if (body.op === "close") {
    session.open = false;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    closeSurfaceInteractive(surfaceId);
    touch(session);
    return response(session);
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
    resetSubjectInventory(session, nextId);
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    if (session.open) openSurfaceInteractive(surfaceId, session.subject, "shop");
    touch(session);
    return response(session);
  }

  if (body.op === "set-view") {
    const view = body.view as PinoriaStoreView;
    if (!VALID_VIEWS.has(view)) return NextResponse.json({ ok: false, error: "INVALID_VIEW" }, { status: 400 });
    session.view = view;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    if (session.open) setSurfaceInteractiveView(surfaceId, view);
    touch(session);
    return response(session);
  }

  if (body.op === "set-category") {
    const category = body.category as ShopCategoryId;
    if (!VALID_CATEGORIES.has(category)) return NextResponse.json({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
    session.category = category;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return response(session);
  }

  if (body.op === "preview") {
    session.selectedAssetId = typeof body.assetId === "string" && body.assetId ? body.assetId : null;
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return response(session);
  }

  if (body.op === "set-inventory-filter") {
    const filter = body.filter as InventoryFilter;
    if (!VALID_INVENTORY_FILTERS.has(filter)) return NextResponse.json({ ok: false, error: "INVALID_INVENTORY_FILTER" }, { status: 400 });
    session.inventoryFilter = filter;
    session.inventorySelectedId = null;
    touch(session);
    return response(session);
  }

  if (body.op === "inventory-preview") {
    const itemId = typeof body.itemId === "string" && body.itemId ? body.itemId : null;
    if (itemId && !session.ownedAssetIds.includes(itemId) && !session.earnedAchievementIds.includes(itemId)) {
      return NextResponse.json({ ok: false, error: "ITEM_NOT_OWNED" }, { status: 400 });
    }
    session.inventorySelectedId = itemId;
    touch(session);
    return response(session);
  }

  if (body.op === "equip-wearable") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const slot = body.slot as InventoryWearableSlot;
    if (!itemId || !session.ownedAssetIds.includes(itemId)) return NextResponse.json({ ok: false, error: "ITEM_NOT_OWNED" }, { status: 400 });
    if (!VALID_WEARABLE_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    setCharacterWearable(session.subject.id, slot, itemId);
    syncSessionCharacter(session);
    session.inventorySelectedId = itemId;
    touch(session);
    return response(session);
  }

  if (body.op === "unequip-wearable") {
    const slot = body.slot as InventoryWearableSlot;
    if (!VALID_WEARABLE_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    setCharacterWearable(session.subject.id, slot, null);
    syncSessionCharacter(session);
    touch(session);
    return response(session);
  }

  if (body.op === "equip-achievement") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const slot = body.slot as InventoryAchievementSlot;
    if (!itemId || !session.earnedAchievementIds.includes(itemId)) return NextResponse.json({ ok: false, error: "ACHIEVEMENT_NOT_EARNED" }, { status: 400 });
    if (itemId.startsWith("badge-")) return NextResponse.json({ ok: false, error: "MARK_AUTO_EQUIPPED" }, { status: 400 });
    if (!VALID_ACHIEVEMENT_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    setCharacterAchievement(session.subject.id, slot, itemId);
    syncSessionCharacter(session);
    session.inventorySelectedId = itemId;
    touch(session);
    return response(session);
  }

  if (body.op === "unequip-achievement") {
    const slot = body.slot as InventoryAchievementSlot;
    if (!VALID_ACHIEVEMENT_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    setCharacterAchievement(session.subject.id, slot, null);
    syncSessionCharacter(session);
    touch(session);
    return response(session);
  }

  if (body.op === "begin-purchase") {
    if (typeof body.assetId !== "string" || !body.assetId) return NextResponse.json({ ok: false, error: "INVALID_ASSET" }, { status: 400 });
    session.selectedAssetId = body.assetId;
    session.pendingPurchaseAssetId = body.assetId;
    session.purchaseResult = null;
    touch(session);
    return response(session);
  }

  if (body.op === "cancel-purchase") {
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return response(session);
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
      grantCharacterAsset(session.subject.id, assetId);
      syncSessionCharacter(session);
    }

    session.purchaseResult = { id: ++session.purchaseSeq, assetId, status, at: Date.now() };
    session.pendingPurchaseAssetId = null;
    session.selectedAssetId = assetId;
    touch(session);
    return response(session, status === "purchased" || status === "already-owned");
  }

  return NextResponse.json({ ok: false, error: "UNSUPPORTED_OPERATION" }, { status: 400 });
}
