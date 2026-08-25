"use client";

import { useEffect, useMemo, useState } from "react";
import {
  prototypeCharacterEffects,
  prototypeFloatingProps,
} from "../pinoria-tv/prototype-assets";
import {
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_CATEGORIES,
  PINORIA_SHOP_LOGO,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  PINORIA_SURFACE_SESSION_URL,
  type InventoryAchievementSlot,
  type InventoryWearableSlot,
  type PinoriaStoreView,
  type PinoriaSurfaceSessionSnapshot,
  type ShopCatalogItem,
  type ShopCategoryId,
  type ShopSessionSnapshot,
} from "../pinoria-tv/shop-types";

type ControllerInventoryItem =
  | {
      id: string;
      kind: "wearable";
      displayName: string;
      imageUrl: string;
      slot: InventoryWearableSlot;
      equipped: boolean;
      catalog: ShopCatalogItem;
    }
  | {
      id: string;
      kind: "achievement";
      displayName: string;
      imageUrl: string;
      level: number;
      equipped: boolean;
    };

type AchievementDefinition = {
  prefix: string;
  displayName: string;
  imageUrl: string;
};

const SUBJECTS = [
  { id: "bo", name: "Bơ", pls: 420 },
  { id: "tri", name: "Tri", pls: 520 },
  { id: "an", name: "An", pls: 360 },
  { id: "mai", name: "Mai", pls: 280 },
] as const;

const ACHIEVEMENT_SLOTS: readonly InventoryAchievementSlot[] = [
  "achievement-1",
  "achievement-2",
  "achievement-3",
  "achievement-4",
  "achievement-5",
  "achievement-6",
  "achievement-7",
  "achievement-8",
];

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { prefix: "achievement-brush", displayName: "Cọ Hành Trình", imageUrl: prototypeFloatingProps[0].src },
  { prefix: "achievement-scroll", displayName: "Cuộn Nhạc", imageUrl: prototypeFloatingProps[1].src },
  { prefix: "achievement-palette", displayName: "Bảng Màu", imageUrl: prototypeFloatingProps[2].src },
  { prefix: "achievement-maker", displayName: "Bộ Dụng Cụ", imageUrl: prototypeFloatingProps[3].src },
  { prefix: "badge-artchitect", displayName: "Dấu Ấn ArtChitect", imageUrl: prototypeCharacterEffects.marks[0].src },
  { prefix: "badge-pianohouse", displayName: "Dấu Ấn Piano House", imageUrl: prototypeCharacterEffects.marks[1].src },
  { prefix: "badge-house-helper", displayName: "Huy Hiệu Đồng Đội", imageUrl: prototypeCharacterEffects.marks[2].src },
];

function roman(level: number) {
  return ["", "I", "II", "III", "IV", "V"][level] ?? String(level);
}

function achievementInfo(id: string) {
  const levelMatch = id.match(/-l(\d+)$/);
  const prefix = id.replace(/-l\d+$/, "");
  const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.prefix === prefix);
  if (!definition || !levelMatch) return null;
  return { ...definition, id, level: Math.max(1, Number(levelMatch[1]) || 1) };
}

function wearableLabel(slot: string) {
  return ({
    hair: "Tóc",
    face: "Mặt",
    headwear: "Nón",
    eyewear: "Kính",
    back: "Cánh",
    body: "Trang phục",
  } as Record<string, string>)[slot] ?? slot;
}

function tvModeLabel(mode: string) {
  return ({
    ambient: "House Ambient",
    arrival: "Arrival",
    choice: "Quick Choice",
    ritual: "Ritual",
    reward: "Hạt Năng Lượng",
    learning: "Learning Spotlight",
    broadcast: "World Broadcast",
    "world-transition": "World State Transition",
    departure: "Departure",
    shop: "Shop",
    inventory: "Túi Hành Trang",
  } as Record<string, string>)[mode] ?? mode;
}

export function PinoriaStaffController() {
  const [catalog, setCatalog] = useState<ShopCatalogItem[]>([]);
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);
  const [surface, setSurface] = useState<PinoriaSurfaceSessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { items?: ShopCatalogItem[] }) => {
        if (!cancelled && Array.isArray(data.items)) setCatalog(data.items);
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được catalog Pinoria.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [shopResponse, surfaceResponse] = await Promise.all([
          fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${encodeURIComponent(PINORIA_SHOP_SURFACE_ID)}`, { cache: "no-store" }),
          fetch(`${PINORIA_SURFACE_SESSION_URL}?surfaceId=${encodeURIComponent(PINORIA_SHOP_SURFACE_ID)}`, { cache: "no-store" }),
        ]);
        const shopData = await shopResponse.json().catch(() => ({})) as { session?: ShopSessionSnapshot };
        const surfaceData = await surfaceResponse.json().catch(() => ({})) as { surface?: PinoriaSurfaceSessionSnapshot };
        if (!stopped) {
          if (shopResponse.ok && shopData.session) setSession(shopData.session);
          if (surfaceResponse.ok && surfaceData.surface) setSurface(surfaceData.surface);
          if (!shopResponse.ok || !surfaceResponse.ok) setError("Không đọc được SurfaceSession của Reception TV.");
        }
      } catch {
        if (!stopped) {
          setSurface((current) => current ? { ...current, online: false } : null);
          setError("Mất kết nối với Reception TV.");
        }
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 600);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!session?.open) {
      setPurchaseOpen(false);
      setSlotPickerOpen(false);
    }
  }, [session?.open]);

  async function send(op: string, payload: Record<string, unknown> = {}) {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(PINORIA_SHOP_RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceId: PINORIA_SHOP_SURFACE_ID, op, ...payload }),
      });
      const data = await response.json() as {
        ok?: boolean;
        session?: ShopSessionSnapshot;
        surface?: PinoriaSurfaceSessionSnapshot;
        error?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.error || "REQUEST_FAILED");
      if (data.session) setSession(data.session);
      if (data.surface) setSurface(data.surface);
      return data.session ?? null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "REQUEST_FAILED";
      setError(message === "ITEM_NOT_OWNED" || message === "ACHIEVEMENT_NOT_EARNED" ? "Học viên chưa sở hữu món này." : "Không thể gửi lệnh lên TV.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const shopItems = useMemo(() => {
    if (!session || session.category === "all") return catalog;
    return catalog.filter((item) => item.category === session.category);
  }, [catalog, session]);

  const selectedShopItem = useMemo(
    () => catalog.find((item) => item.assetId === session?.selectedAssetId),
    [catalog, session?.selectedAssetId],
  );

  const inventoryItems = useMemo<ControllerInventoryItem[]>(() => {
    if (!session) return [];
    const equippedWearables = new Set(Object.values(session.equipment.wearables));
    const equippedAchievements = new Set(Object.values(session.equipment.achievements));
    const wearableItems: ControllerInventoryItem[] = catalog
      .filter((item) => session.ownedAssetIds.includes(item.assetId))
      .map((item) => ({
        id: item.assetId,
        kind: "wearable" as const,
        displayName: item.displayName,
        imageUrl: item.imageUrl,
        slot: item.slot as InventoryWearableSlot,
        equipped: equippedWearables.has(item.assetId),
        catalog: item,
      }));
    const achievements: ControllerInventoryItem[] = session.earnedAchievementIds
      .map(achievementInfo)
      .filter((item): item is NonNullable<ReturnType<typeof achievementInfo>> => !!item)
      .map((item) => ({
        id: item.id,
        kind: "achievement" as const,
        displayName: item.displayName,
        imageUrl: item.imageUrl,
        level: item.level,
        equipped: equippedAchievements.has(item.id),
      }));
    return [...wearableItems, ...achievements];
  }, [catalog, session]);

  const selectedInventoryItem = inventoryItems.find((item) => item.id === session?.inventorySelectedId);
  const selectedAchievementSlot = selectedInventoryItem?.kind === "achievement"
    ? ACHIEVEMENT_SLOTS.find((slot) => session?.equipment.achievements[slot] === selectedInventoryItem.id)
    : undefined;

  const subject = session?.subject ?? SUBJECTS[0];
  const view: PinoriaStoreView = surface?.interactive?.view ?? session?.view ?? "shop";
  const tvOnline = !!surface?.online;
  const baseMode = surface?.baseMode ?? "ambient";
  const effectiveMode = surface?.effectiveMode ?? "ambient";
  const interactiveOpen = !!surface?.interactive;
  const tvReady = tvOnline && baseMode === "ambient";
  const interactiveReady = tvReady && interactiveOpen;
  const interactiveLabel = !tvOnline
    ? "Reception TV offline"
    : surface?.interactiveSuspended && surface.interactive
      ? `${tvModeLabel(surface.interactive.view)} tạm ẩn · sẽ tự trở lại`
      : surface?.interactive
        ? `${tvModeLabel(surface.interactive.view)} đang mở`
        : "House Ambient";

  function ensureTvReady() {
    if (!tvOnline) {
      setError("Reception TV đang offline. Hãy mở /pinoria-tv trên TV trước.");
      return false;
    }
    if (baseMode !== "ambient") {
      setError(`Reception TV đang chạy ${tvModeLabel(baseMode)}. Interactive session đang tạm ẩn.`);
      return false;
    }
    return true;
  }

  async function changeSubject(id: string) {
    if (!ensureTvReady()) return;
    const next = SUBJECTS.find((item) => item.id === id);
    if (!next) return;
    await send("set-subject", { subject: next });
  }

  async function toggleInteractiveSession() {
    if (interactiveOpen) {
      await send("close");
      return;
    }
    if (!ensureTvReady()) return;
    await send("open", { subject });
  }

  async function switchView(nextView: PinoriaStoreView) {
    if (!ensureTvReady()) return;
    if (!interactiveOpen) {
      const opened = await send("open", { subject });
      if (!opened) return;
    }
    await send("set-view", { view: nextView });
  }

  async function selectShopItem(item: ShopCatalogItem) {
    if (!interactiveReady || !ensureTvReady()) return;
    await send("preview", { assetId: item.assetId });
  }

  async function beginPurchase() {
    if (!selectedShopItem || !interactiveReady || !ensureTvReady()) return;
    await send("begin-purchase", { assetId: selectedShopItem.assetId });
    setPurchaseOpen(true);
  }

  async function confirmPurchase() {
    if (!selectedShopItem || !interactiveReady || !ensureTvReady()) return;
    const result = await send("confirm-purchase", { assetId: selectedShopItem.assetId, pricePls: selectedShopItem.pricePls });
    if (result) setPurchaseOpen(false);
  }

  async function cancelPurchase() {
    await send("cancel-purchase");
    setPurchaseOpen(false);
  }

  async function selectInventoryItem(item: ControllerInventoryItem) {
    if (!interactiveReady || !ensureTvReady()) return;
    await send("inventory-preview", { itemId: item.id });
  }

  async function toggleWearable(item: Extract<ControllerInventoryItem, { kind: "wearable" }>) {
    if (!interactiveReady || !ensureTvReady()) return;
    if (item.equipped) {
      await send("unequip-wearable", { slot: item.slot });
      return;
    }
    await send("equip-wearable", { itemId: item.id, slot: item.slot });
  }

  async function unequipAchievement() {
    if (!selectedAchievementSlot || !interactiveReady || !ensureTvReady()) return;
    await send("unequip-achievement", { slot: selectedAchievementSlot });
  }

  async function equipAchievement(slot: InventoryAchievementSlot) {
    if (!selectedInventoryItem || selectedInventoryItem.kind !== "achievement" || !interactiveReady || !ensureTvReady()) return;
    const result = await send("equip-achievement", { itemId: selectedInventoryItem.id, slot });
    if (result) setSlotPickerOpen(false);
  }

  return (
    <main className="psc-shell">
      <div className="psc-phone">
        <header className="psc-header">
          <div className="psc-brand-row">
            <div className="psc-brand-lockup">
              <img src={PINORIA_SHOP_LOGO} alt="Pinoria" className="psc-logo" />
              <div className="psc-brand-divider" />
              <div>
                <div className="psc-kicker">PINO TEAM OS</div>
                <strong>Pinoria Staff</strong>
              </div>
            </div>
            <div className={`psc-live ${tvOnline ? "is-online" : ""}`} aria-live="polite">
              <span />{tvOnline ? "TV online" : "TV offline"}
            </div>
          </div>

          <div className="psc-student-card">
            <div className="psc-avatar">{subject.name.slice(0, 1)}</div>
            <label className="psc-student-copy">
              <span>Học viên đang điều khiển</span>
              <select value={subject.id} disabled={busy || !tvReady} onChange={(event) => void changeSubject(event.target.value)}>
                {SUBJECTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="psc-pls"><b>{subject.pls}</b><span>PLS</span></div>
          </div>

          <div className="psc-session-row">
            <div className="psc-session-copy">
              <span>RECEPTION TV · {tvOnline ? tvModeLabel(effectiveMode) : "OFFLINE"}</span>
              <strong>{interactiveLabel}</strong>
            </div>
            <button
              type="button"
              className={`psc-session-toggle ${interactiveOpen ? "is-open" : ""}`}
              disabled={busy || (!tvOnline && !interactiveOpen) || (baseMode !== "ambient" && !interactiveOpen)}
              onClick={() => void toggleInteractiveSession()}
            >
              {interactiveOpen ? "Đóng" : "Mở Shop"}
            </button>
          </div>

          <div className="psc-view-switch" role="tablist" aria-label="Khu vực Pinoria">
            <button type="button" disabled={busy || !tvReady} className={view === "shop" ? "active" : ""} onClick={() => void switchView("shop")}>✦ Shop</button>
            <button type="button" disabled={busy || !tvReady} className={view === "inventory" ? "active" : ""} onClick={() => void switchView("inventory")}>⌘ Túi hành trang</button>
          </div>
        </header>

        {error ? <div className="psc-error">{error}</div> : null}

        {view === "shop" ? (
          <section className="psc-content" aria-label="Pinoria Shop controller">
            <div className="psc-section-head">
              <div><span>SHOP</span><strong>{surface?.interactiveSuspended ? "TV đang bận · Shop sẽ tự trở lại" : "Chọn món để hiện lên TV"}</strong></div>
              <small>{shopItems.length} món</small>
            </div>

            <div className="psc-category-strip">
              {PINORIA_SHOP_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={session?.category === category.id ? "active" : ""}
                  disabled={busy || !interactiveReady}
                  onClick={() => void send("set-category", { category: category.id as ShopCategoryId })}
                >
                  <span>{category.icon}</span>{category.label}
                </button>
              ))}
            </div>

            <div className="psc-shop-grid">
              {shopItems.map((item) => {
                const active = selectedShopItem?.assetId === item.assetId;
                const owned = !!session?.ownedAssetIds.includes(item.assetId);
                return (
                  <button key={item.assetId} disabled={!interactiveReady} type="button" className={`psc-shop-card ${active ? "active" : ""}`} onClick={() => void selectShopItem(item)}>
                    <div className="psc-card-art"><img src={item.imageUrl} alt="" /></div>
                    <strong>{item.displayName}</strong>
                    <span className={owned ? "owned" : ""}>{owned ? "Đã có" : `${item.pricePls} PLS`}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="psc-content" aria-label="Túi Hành Trang controller">
            <div className="psc-section-head">
              <div><span>TÚI HÀNH TRANG</span><strong>{surface?.interactiveSuspended ? "TV đang bận · Túi sẽ tự trở lại" : "Chọn món để trang bị"}</strong></div>
              <small>{inventoryItems.length} món</small>
            </div>

            <div className="psc-inventory-summary">
              <div><span>Wearable</span><b>{session?.ownedAssetIds.length ?? 0}</b></div>
              <div><span>Thành quả</span><b>{session?.earnedAchievementIds.length ?? 0}</b></div>
              <div><span>Đang mang</span><b>{Object.keys(session?.equipment.wearables ?? {}).length + Object.keys(session?.equipment.achievements ?? {}).length}</b></div>
            </div>

            <div className="psc-inventory-grid">
              {inventoryItems.map((item) => {
                const active = selectedInventoryItem?.id === item.id;
                return (
                  <button key={item.id} disabled={!interactiveReady} type="button" className={`psc-inventory-card ${active ? "active" : ""} ${item.equipped ? "equipped" : ""}`} onClick={() => void selectInventoryItem(item)}>
                    {item.kind === "achievement" ? <i>{roman(item.level)}</i> : null}
                    <img src={item.imageUrl} alt="" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="psc-action-dock" aria-live="polite">
          {view === "shop" ? (
            selectedShopItem ? (
              <>
                <div className="psc-action-item">
                  <img src={selectedShopItem.imageUrl} alt="" />
                  <div><strong>{selectedShopItem.displayName}</strong><span>{session?.ownedAssetIds.includes(selectedShopItem.assetId) ? "Đã sở hữu" : `${selectedShopItem.pricePls} PLS`}</span></div>
                </div>
                <div className="psc-action-buttons">
                  <button type="button" className="secondary" disabled={busy || !interactiveReady} onClick={() => void selectShopItem(selectedShopItem)}>Hiện TV</button>
                  <button type="button" className="primary" disabled={busy || !interactiveReady || !!session?.ownedAssetIds.includes(selectedShopItem.assetId)} onClick={() => void beginPurchase()}>
                    {session?.ownedAssetIds.includes(selectedShopItem.assetId) ? "Đã có" : "Mua"}
                  </button>
                </div>
              </>
            ) : <div className="psc-empty-action">{interactiveReady ? "Chạm một món để điều khiển TV" : interactiveOpen ? "Interactive session đang tạm ẩn" : "Mở Shop để bắt đầu"}</div>
          ) : (
            selectedInventoryItem ? (
              <>
                <div className="psc-action-item">
                  <img src={selectedInventoryItem.imageUrl} alt="" />
                  <div>
                    <strong>{selectedInventoryItem.displayName}</strong>
                    <span>{selectedInventoryItem.kind === "achievement" ? `Thành quả · Cấp ${roman(selectedInventoryItem.level)}` : wearableLabel(selectedInventoryItem.slot)}</span>
                  </div>
                </div>
                <div className="psc-action-buttons">
                  <button type="button" className="secondary" disabled={busy || !interactiveReady} onClick={() => void selectInventoryItem(selectedInventoryItem)}>Hiện TV</button>
                  {selectedInventoryItem.kind === "wearable" ? (
                    <button type="button" className="primary" disabled={busy || !interactiveReady} onClick={() => void toggleWearable(selectedInventoryItem)}>{selectedInventoryItem.equipped ? "Tháo" : "Trang bị"}</button>
                  ) : selectedAchievementSlot ? (
                    <button type="button" className="primary" disabled={busy || !interactiveReady} onClick={() => void unequipAchievement()}>Tháo</button>
                  ) : (
                    <button type="button" className="primary" disabled={busy || !interactiveReady} onClick={() => setSlotPickerOpen(true)}>Trang bị</button>
                  )}
                </div>
              </>
            ) : <div className="psc-empty-action">{interactiveReady ? "Chạm một món trong túi để trang bị" : interactiveOpen ? "Interactive session đang tạm ẩn" : "Mở Túi Hành Trang để bắt đầu"}</div>
          )}
        </div>
      </div>

      {purchaseOpen && selectedShopItem ? (
        <div className="psc-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) void cancelPurchase(); }}>
          <section className="psc-sheet" role="dialog" aria-modal="true" aria-label="Xác nhận mua món">
            <div className="psc-sheet-handle" />
            <img src={selectedShopItem.imageUrl} alt="" className="psc-sheet-art" />
            <span className="psc-sheet-kicker">XÁC NHẬN CHO {subject.name.toUpperCase()}</span>
            <h2>{selectedShopItem.displayName}</h2>
            <p>Đổi <strong>{selectedShopItem.pricePls} PLS</strong>. TV đang giữ màn hình xác nhận để học viên nhìn thấy món đã chọn.</p>
            <div className="psc-sheet-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => void cancelPurchase()}>Quay lại</button>
              <button type="button" className="primary" disabled={busy || !interactiveReady || subject.pls < selectedShopItem.pricePls} onClick={() => void confirmPurchase()}>{subject.pls < selectedShopItem.pricePls ? "Không đủ PLS" : "Xác nhận mua"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {slotPickerOpen && selectedInventoryItem?.kind === "achievement" ? (
        <div className="psc-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSlotPickerOpen(false); }}>
          <section className="psc-sheet" role="dialog" aria-modal="true" aria-label="Chọn ô thành quả">
            <div className="psc-sheet-handle" />
            <span className="psc-sheet-kicker">THÀNH QUẢ ĐANG MANG</span>
            <h2>Đặt vào ô nào?</h2>
            <p>Chọn một trong 8 vị trí quanh Piner. Nếu ô đã có thành quả, món mới sẽ thay vị trí đó.</p>
            <div className="psc-slot-grid">
              {ACHIEVEMENT_SLOTS.map((slot, index) => {
                const occupiedId = session?.equipment.achievements[slot];
                const occupied = occupiedId ? achievementInfo(occupiedId) : null;
                return (
                  <button key={slot} type="button" disabled={busy || !interactiveReady} onClick={() => void equipAchievement(slot)}>
                    <span>{index + 1}</span>
                    {occupied ? <img src={occupied.imageUrl} alt="" /> : <i>✦</i>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="psc-sheet-cancel" onClick={() => setSlotPickerOpen(false)}>Đóng</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
