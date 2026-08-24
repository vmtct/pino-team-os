import { NextRequest, NextResponse } from "next/server";
import type {
  InventoryAchievementSlot,
  InventoryEquipmentState,
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

const SUBJECT_STARTING_OWNED: Record<string, string[]> = {
  bo: ["asset_hologram_wings", "asset_painting_outfit_01", "asset_hair_01", "asset_face_01", "asset_birthday_hat", "asset_star_glasses"],
  tri: ["asset_piano_outfit_01", "asset_hair_01", "asset_face_02", "asset_conical_hat", "asset_party_glasses"],
  an: ["asset_hologram_wings", "asset_painting_outfit_02", "asset_hair_01", "asset_face_03", "asset_conical_hat"],
  mai: ["asset_base_body_01", "asset_hair_01", "asset_face_04", "asset_birthday_hat", "asset_party_glasses"],
};

// Achievement IDs model current family levels, not a history stack. When a
// learner levels up a family, Core will replace the current ID rather than add
// another card for the same family.
const SUBJECT_STARTING_ACHIEVEMENTS: Record<string, string[]> = {
  bo: ["achievement-brush-l2", "achievement-scroll-l3", "achievement-palette-l2", "achievement-maker-l1", "badge-artchitect-l3", "badge-pianohouse-l2", "badge-house-helper-l1"],
  tri: ["achievement-scroll-l3", "achievement-maker-l2", "badge-pianohouse-l3", "badge-house-helper-l1"],
  an: ["achievement-brush-l3", "achievement-palette-l2", "badge-artchitect-l3", "badge-house-helper-l2"],
  mai: ["achievement-brush-l1", "achievement-scroll-l1", "badge-artchitect-l1"],
};

const SUBJECT_STARTING_EQUIPMENT: Record<string, InventoryEquipmentState> = {
  bo: {
    wearables: {
      back: "asset_hologram_wings",
      body: "asset_painting_outfit_01",
      hair: "asset_hair_01",
      face: "asset_face_01",
      headwear: "asset_birthday_hat",
      eyewear: "asset_star_glasses",
    },
    achievements: {
      "achievement-1": "achievement-brush-l2",
      "achievement-2": "achievement-palette-l2",
      "achievement-3": "badge-artchitect-l3",
    },
  },
  tri: {
    wearables: {
      body: "asset_piano_outfit_01",
      hair: "asset_hair_01",
      face: "asset_face_02",
      headwear: "asset_conical_hat",
      eyewear: "asset_party_glasses",
    },
    achievements: {
      "achievement-1": "achievement-scroll-l3",
      "achievement-2": "achievement-maker-l2",
      "achievement-3": "badge-pianohouse-l3",
    },
  },
  an: {
    wearables: {
      back: "asset_hologram_wings",
      body: "asset_painting_outfit_02",
      hair: "asset_hair_01",
      face: "asset_face_03",
      headwear: "asset_conical_hat",
    },
    achievements: {
      "achievement-1": "achievement-brush-l3",
      "achievement-2": "achievement-palette-l2",
      "achievement-3": "badge-artchitect-l3",
    },
  },
  mai: {
    wearables: {
      body: "asset_base_body_01",
      hair: "asset_hair_01",
      face: "asset_face_04",
      headwear: "asset_birthday_hat",
      eyewear: "asset_party_glasses",
    },
    achievements: {
      "achievement-1": "achievement-brush-l1",
      "achievement-2": "badge-artchitect-l1",
    },
  },
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

function initialAchievements(subjectId: string) {
  return [...(SUBJECT_STARTING_ACHIEVEMENTS[subjectId] ?? [])];
}

function initialEquipment(subjectId: string): InventoryEquipmentState {
  const source = SUBJECT_STARTING_EQUIPMENT[subjectId] ?? { wearables: {}, achievements: {} };
  return { wearables: { ...source.wearables }, achievements: { ...source.achievements } };
}

function resetSubjectInventory(session: MutableShopSession, subjectId: string) {
  session.view = "shop";
  session.ownedAssetIds = initialOwned(subjectId);
  session.earnedAchievementIds = initialAchievements(subjectId);
  session.inventorySelectedId = null;
  session.equipment = initialEquipment(subjectId);
  session.selectedAssetId = null;
  session.category = "all";
}

function getSession(surfaceId: string): MutableShopSession {
  if (!store.sessions[surfaceId]) {
    store.sessions[surfaceId] = {
      surfaceId,
      open: false,
      view: "shop",
      subject: { ...DEFAULT_SUBJECT },
      category: "all",
      selectedAssetId: null,
      pendingPurchaseAssetId: null,
      ownedAssetIds: initialOwned(DEFAULT_SUBJECT.id),
      earnedAchievementIds: initialAchievements(DEFAULT_SUBJECT.id),
      inventorySelectedId: null,
      equipment: initialEquipment(DEFAULT_SUBJECT.id),
      purchaseResult: null,
      updatedAt: Date.now(),
      purchaseSeq: 0,
    };
  }

  // Backfill hot-reloaded prototype sessions created before the inventory view.
  const session = store.sessions[surfaceId];
  session.view ??= "shop";
  session.earnedAchievementIds ??= initialAchievements(session.subject.id);
  session.inventorySelectedId ??= null;
  session.equipment ??= initialEquipment(session.subject.id);
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
    resetSubjectInventory(session, nextId);
    session.pendingPurchaseAssetId = null;
    session.purchaseResult = null;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "set-view") {
    const view = body.view as PinoriaStoreView;
    if (!VALID_VIEWS.has(view)) return NextResponse.json({ ok: false, error: "INVALID_VIEW" }, { status: 400 });
    session.view = view;
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

  if (body.op === "inventory-preview") {
    const itemId = typeof body.itemId === "string" && body.itemId ? body.itemId : null;
    if (itemId && !session.ownedAssetIds.includes(itemId) && !session.earnedAchievementIds.includes(itemId)) {
      return NextResponse.json({ ok: false, error: "ITEM_NOT_OWNED" }, { status: 400 });
    }
    session.inventorySelectedId = itemId;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "equip-wearable") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const slot = body.slot as InventoryWearableSlot;
    if (!itemId || !session.ownedAssetIds.includes(itemId)) return NextResponse.json({ ok: false, error: "ITEM_NOT_OWNED" }, { status: 400 });
    if (!VALID_WEARABLE_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    session.equipment.wearables[slot] = itemId;
    session.inventorySelectedId = itemId;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "unequip-wearable") {
    const slot = body.slot as InventoryWearableSlot;
    if (!VALID_WEARABLE_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    delete session.equipment.wearables[slot];
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "equip-achievement") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const slot = body.slot as InventoryAchievementSlot;
    if (!itemId || !session.earnedAchievementIds.includes(itemId)) return NextResponse.json({ ok: false, error: "ACHIEVEMENT_NOT_EARNED" }, { status: 400 });
    if (!VALID_ACHIEVEMENT_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    for (const existingSlot of VALID_ACHIEVEMENT_SLOTS) {
      if (session.equipment.achievements[existingSlot] === itemId) delete session.equipment.achievements[existingSlot];
    }
    session.equipment.achievements[slot] = itemId;
    session.inventorySelectedId = itemId;
    touch(session);
    return NextResponse.json({ ok: true, session: snapshot(session) });
  }

  if (body.op === "unequip-achievement") {
    const slot = body.slot as InventoryAchievementSlot;
    if (!VALID_ACHIEVEMENT_SLOTS.has(slot)) return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
    delete session.equipment.achievements[slot];
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
