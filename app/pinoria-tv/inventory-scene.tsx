"use client";

import { useEffect, useMemo, useState } from "react";
import { AMBIENT_HOUSE_ARRIVAL_ASSETS } from "./arrival-visual-config";
import {
  PrototypeCharacter,
  PrototypeCompanion,
  prototypeCharacterEffects,
  prototypeFloatingProps,
  type PrototypeCharacterLayerOverrides,
  type PrototypeCharacterSlot,
} from "./prototype-assets";
import {
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_LOGO,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  type InventoryAchievementSlot,
  type InventoryWearableSlot,
  type ShopCatalogItem,
  type ShopSessionSnapshot,
} from "./shop-types";

const WEARABLE_SLOTS: readonly InventoryWearableSlot[] = ["hair", "face", "headwear", "eyewear", "back", "body"];
const ACHIEVEMENT_SLOTS: readonly { id: InventoryAchievementSlot; label: string }[] = [
  { id: "artifact-1", label: "Đạo cụ I" },
  { id: "artifact-2", label: "Đạo cụ II" },
  { id: "badge", label: "Huy hiệu" },
];

const SLOT_LABELS: Record<InventoryWearableSlot, string> = {
  hair: "Tóc",
  face: "Mặt",
  headwear: "Nón",
  eyewear: "Kính",
  back: "Cánh",
  body: "Trang phục",
};

const SLOT_ICONS: Record<InventoryWearableSlot, string> = {
  hair: "◒",
  face: "☺",
  headwear: "⌒",
  eyewear: "◎",
  back: "◇",
  body: "♢",
};

type AchievementKind = "artifact" | "badge";
type AchievementFamily = {
  prefix: string;
  displayName: string;
  description: string;
  kind: AchievementKind;
  imageUrl: string;
  maxLevel: number;
};

type AchievementItem = AchievementFamily & {
  id: string;
  level: number;
};

type InventoryItem =
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
      achievementKind: AchievementKind;
      level: number;
      maxLevel: number;
      description: string;
      equipped: boolean;
    };

const ACHIEVEMENT_FAMILIES: AchievementFamily[] = [
  {
    prefix: "achievement-brush",
    displayName: "Cọ Hành Trình",
    description: "Thành quả hội họa đã chinh phục.",
    kind: "artifact",
    imageUrl: prototypeFloatingProps[0].src,
    maxLevel: 4,
  },
  {
    prefix: "achievement-scroll",
    displayName: "Cuộn Nhạc",
    description: "Dấu mốc repertoire đã hoàn thành.",
    kind: "artifact",
    imageUrl: prototypeFloatingProps[1].src,
    maxLevel: 4,
  },
  {
    prefix: "achievement-palette",
    displayName: "Bảng Màu",
    description: "Thành quả từ hành trình màu sắc.",
    kind: "artifact",
    imageUrl: prototypeFloatingProps[2].src,
    maxLevel: 4,
  },
  {
    prefix: "achievement-maker",
    displayName: "Bộ Dụng Cụ",
    description: "Dấu mốc tạo tác và dự án đặc biệt.",
    kind: "artifact",
    imageUrl: prototypeFloatingProps[3].src,
    maxLevel: 4,
  },
  {
    prefix: "badge-artchitect",
    displayName: "Dấu Ấn ArtChitect",
    description: "Huy hiệu chiều sâu hành trình mỹ thuật.",
    kind: "badge",
    imageUrl: prototypeCharacterEffects.marks[0].src,
    maxLevel: 4,
  },
  {
    prefix: "badge-pianohouse",
    displayName: "Dấu Ấn Piano House",
    description: "Huy hiệu chiều sâu hành trình piano.",
    kind: "badge",
    imageUrl: prototypeCharacterEffects.marks[1].src,
    maxLevel: 4,
  },
  {
    prefix: "badge-house-helper",
    displayName: "Huy Hiệu Đồng Đội",
    description: "Thành quả đóng góp cho cộng đồng House.",
    kind: "badge",
    imageUrl: prototypeCharacterEffects.marks[2].src,
    maxLevel: 4,
  },
];

function achievementFromId(id: string): AchievementItem | null {
  const levelMatch = id.match(/-l(\d+)$/);
  if (!levelMatch) return null;
  const level = Number(levelMatch[1]);
  const prefix = id.replace(/-l\d+$/, "");
  const family = ACHIEVEMENT_FAMILIES.find((item) => item.prefix === prefix);
  if (!family || !Number.isFinite(level)) return null;
  return { ...family, id, level: Math.max(1, Math.min(family.maxLevel, level)) };
}

function HouseInventoryBackdrop() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#1a1310" }}>
      {(Object.values(AMBIENT_HOUSE_ARRIVAL_ASSETS) as string[]).map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: "-4%",
            width: "108%",
            height: "108%",
            objectFit: "cover",
            opacity: index === 0 ? .58 : .34,
            filter: "blur(16px) brightness(.28) saturate(.48) sepia(.16)",
            transform: "scale(1.04)",
          }}
        />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 25% 47%,rgba(116,70,55,.15),transparent 37%),radial-gradient(circle at 72% 42%,rgba(96,67,41,.08),transparent 36%),linear-gradient(100deg,rgba(16,10,9,.78),rgba(31,21,17,.84) 48%,rgba(14,9,8,.92))" }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 140px rgba(6,3,2,.48)" }} />
    </div>
  );
}

function levelRoman(level: number) {
  return ["", "I", "II", "III", "IV", "V"][level] ?? String(level);
}

function EquipmentSlot({ label, imageUrl, empty, level }: { label: string; imageUrl?: string; empty?: boolean; level?: number }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 5 }}>
      <div style={{ position: "relative", width: 68, height: 68, borderRadius: 19, display: "grid", placeItems: "center", background: empty ? "rgba(255,255,255,.018)" : "radial-gradient(circle,rgba(240,198,111,.11),rgba(42,28,23,.82) 68%)", border: empty ? "1px dashed rgba(238,208,153,.18)" : "1px solid rgba(236,191,104,.28)", boxShadow: empty ? undefined : "0 11px 28px rgba(0,0,0,.18),inset 0 0 18px rgba(234,188,95,.04)" }}>
        {imageUrl ? <img src={imageUrl} alt="" draggable={false} style={{ width: "82%", height: "82%", objectFit: "contain", filter: "drop-shadow(0 7px 9px rgba(0,0,0,.24))" }} /> : <span style={{ color: "rgba(242,225,194,.2)", fontSize: 20 }}>＋</span>}
        {level ? <span style={{ position: "absolute", right: -3, bottom: -3, minWidth: 22, height: 22, padding: "0 5px", display: "grid", placeItems: "center", borderRadius: 99, background: "#d7ab55", border: "2px solid #281a15", color: "#281a15", fontSize: 8, fontWeight: 950 }}>LV {levelRoman(level)}</span> : null}
      </div>
      <span style={{ color: "rgba(243,229,204,.5)", fontSize: 8.5, fontWeight: 850, letterSpacing: ".04em" }}>{label}</span>
    </div>
  );
}

export function InventoryScene({ surfaceId = PINORIA_SHOP_SURFACE_ID }: { surfaceId?: string }) {
  const [catalog, setCatalog] = useState<ShopCatalogItem[]>([]);
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { items?: ShopCatalogItem[] }) => {
        if (!cancelled && Array.isArray(data.items)) setCatalog(data.items);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${encodeURIComponent(surfaceId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { session?: ShopSessionSnapshot };
        if (!stopped && data.session) setSession(data.session);
      } catch {
        // Keep the last shared-screen inventory state if the local relay pauses.
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 320);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [surfaceId]);

  const ownedWearables = useMemo(() => {
    const owned = new Set(session?.ownedAssetIds ?? []);
    return catalog.filter((item) => owned.has(item.assetId) && WEARABLE_SLOTS.includes(item.slot as InventoryWearableSlot));
  }, [catalog, session]);

  const achievements = useMemo(() => (session?.earnedAchievementIds ?? []).map(achievementFromId).filter((item): item is AchievementItem => !!item), [session]);

  const equippedWearableIds = new Set(Object.values(session?.equipment?.wearables ?? {}));
  const equippedAchievementIds = new Set(Object.values(session?.equipment?.achievements ?? {}));

  const inventoryItems = useMemo<InventoryItem[]>(() => {
    const wearables: InventoryItem[] = ownedWearables.map((item) => ({
      id: item.assetId,
      kind: "wearable",
      displayName: item.displayName,
      imageUrl: item.imageUrl,
      slot: item.slot as InventoryWearableSlot,
      equipped: equippedWearableIds.has(item.assetId),
      catalog: item,
    }));
    const earned: InventoryItem[] = achievements.map((item) => ({
      id: item.id,
      kind: "achievement",
      displayName: item.displayName,
      imageUrl: item.imageUrl,
      achievementKind: item.kind,
      level: item.level,
      maxLevel: item.maxLevel,
      description: item.description,
      equipped: equippedAchievementIds.has(item.id),
    }));
    return [...wearables, ...earned];
  }, [ownedWearables, achievements, session?.equipment]);

  const selected = inventoryItems.find((item) => item.id === session?.inventorySelectedId) ?? inventoryItems[0];
  const rows = Math.max(1, Math.ceil(inventoryItems.length / 6));

  const layerOverrides = useMemo<PrototypeCharacterLayerOverrides | undefined>(() => {
    if (!catalog.length || !session) return undefined;
    const overrides: PrototypeCharacterLayerOverrides = {};
    for (const slot of WEARABLE_SLOTS) {
      const assetId = session.equipment?.wearables?.[slot];
      const item = assetId ? catalog.find((candidate) => candidate.assetId === assetId) : undefined;
      overrides[slot as PrototypeCharacterSlot] = item?.layerUrl ?? null;
    }
    return overrides;
  }, [catalog, session]);

  const achievementById = useMemo(() => new Map(achievements.map((item) => [item.id, item])), [achievements]);
  const equipmentCount = Object.keys(session?.equipment?.wearables ?? {}).length + Object.keys(session?.equipment?.achievements ?? {}).length;

  return (
    <div data-pinoria-inventory-scene style={{ position: "absolute", inset: 0, overflow: "hidden", color: "#f6ead7", background: "#1b1411" }}>
      <HouseInventoryBackdrop />
      <style>{`
        @keyframes pinoriaInventoryEnter { from { opacity:0; transform:scale(1.008) } to { opacity:1; transform:scale(1) } }
        @keyframes pinoriaInventorySlotPulse { 0%,100% { box-shadow:0 0 0 rgba(226,178,82,0) } 50% { box-shadow:0 0 22px rgba(226,178,82,.12) } }
      `}</style>

      <div style={{ position: "absolute", inset: "28px 46px 32px", display: "grid", gridTemplateColumns: "39% 61%", gridTemplateRows: "92px 1fr", gap: "15px 24px", animation: "pinoriaInventoryEnter .45s ease-out both" }}>
        <header style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "320px minmax(0,1fr) 170px", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={PINORIA_SHOP_LOGO} alt="Pinoria" style={{ width: 150, maxHeight: 60, objectFit: "contain", objectPosition: "left center", filter: "drop-shadow(0 7px 18px rgba(0,0,0,.32))" }} />
            <div style={{ width: 1, height: 42, background: "rgba(245,214,155,.24)" }} />
            <div>
              <div style={{ color: "#f0cb80", fontSize: 12.5, fontWeight: 950, letterSpacing: ".13em" }}>TÚI</div>
              <div style={{ marginTop: 2, color: "#f7e5c4", fontSize: 17, fontWeight: 950, letterSpacing: ".055em" }}>HÀNH TRANG</div>
            </div>
          </div>

          <div style={{ justifySelf: "center", width: "min(720px,100%)", minHeight: 54, padding: "8px 14px", borderRadius: 18, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 12, background: "rgba(39,27,21,.72)", border: "1px solid rgba(239,199,120,.16)", boxShadow: "0 14px 34px rgba(0,0,0,.16)" }}>
            <span style={{ minWidth: 76, padding: "9px 13px", borderRadius: 12, textAlign: "center", background: "linear-gradient(180deg,#f5d486,#d6a84e)", color: "#2a1b12", fontSize: 11.5, fontWeight: 950 }}>Tất cả</span>
            <div>
              <strong style={{ display: "block", fontSize: 12.5, color: "#f1d69f" }}>Mọi món con đang sở hữu</strong>
              <span style={{ display: "block", marginTop: 3, color: "rgba(246,232,208,.48)", fontSize: 9.5 }}>Wearables mua bằng PLS · Đạo cụ & huy hiệu đến từ thành quả</span>
            </div>
            <span style={{ color: "rgba(246,232,208,.54)", fontSize: 10, fontWeight: 850 }}>{inventoryItems.length} món</span>
          </div>

          <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
            <strong style={{ fontSize: 17, color: "#f6ead8" }}>{session?.subject.name ?? "Bơ"}</strong>
            <span style={{ color: "#efc875", fontSize: 11, fontWeight: 900 }}>✦ {equipmentCount} đang trang bị</span>
          </div>
        </header>

        <section style={{ position: "relative", minHeight: 0, borderRadius: 26, overflow: "hidden", border: "1px solid rgba(236,194,115,.2)", background: "linear-gradient(180deg,rgba(46,30,25,.61),rgba(24,16,14,.78))", boxShadow: "0 30px 60px rgba(0,0,0,.27)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 52% 42%,rgba(143,78,195,.13),transparent 52%)" }} />
          <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "1fr auto", padding: "16px 18px 16px" }}>
            <div style={{ position: "relative", minHeight: 0, display: "grid", placeItems: "center" }}>
              <div style={{ position: "absolute", left: 4, top: 2, display: "grid", gap: 10, zIndex: 28 }}>
                <span style={{ color: "rgba(243,229,204,.44)", fontSize: 8.5, fontWeight: 950, letterSpacing: ".12em" }}>THÀNH QUẢ ĐANG MANG</span>
                <div style={{ display: "grid", gap: 10 }}>
                  {ACHIEVEMENT_SLOTS.map((slot) => {
                    const achievementId = session?.equipment?.achievements?.[slot.id];
                    const item = achievementId ? achievementById.get(achievementId) : undefined;
                    return <EquipmentSlot key={slot.id} label={slot.label} imageUrl={item?.imageUrl} level={item?.level} empty={!item} />;
                  })}
                </div>
              </div>

              <div style={{ width: "min(470px,37vw)", aspectRatio: "1 / 1", display: "grid", placeItems: "center", transform: "translateX(22px)" }}>
                <PrototypeCharacter
                  subjectId={session?.subject.id ?? "bo"}
                  motion="shop-preview"
                  layerOverrides={layerOverrides}
                  size="100%"
                  style={{ filter: "drop-shadow(0 19px 22px rgba(0,0,0,.2))" }}
                />
              </div>

              <div style={{ position: "absolute", right: 12, bottom: 8, width: 116, zIndex: 32 }}>
                <PrototypeCompanion size="100%" style={{ filter: "drop-shadow(0 15px 18px rgba(0,0,0,.3))" }} />
              </div>
            </div>

            <div style={{ borderRadius: 18, padding: "10px 12px", background: "rgba(19,12,10,.7)", border: "1px solid rgba(240,196,112,.16)" }}>
              <div style={{ marginBottom: 8, color: "rgba(243,229,204,.42)", fontSize: 8.5, fontWeight: 950, letterSpacing: ".12em" }}>WEARABLE ĐANG MANG</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 7 }}>
                {WEARABLE_SLOTS.map((slot) => {
                  const assetId = session?.equipment?.wearables?.[slot];
                  const item = assetId ? catalog.find((candidate) => candidate.assetId === assetId) : undefined;
                  return (
                    <div key={slot} style={{ minWidth: 0, height: 54, borderRadius: 12, display: "grid", gridTemplateColumns: "24px 1fr", alignItems: "center", gap: 6, padding: "5px 7px", boxSizing: "border-box", background: item ? "rgba(93,61,39,.28)" : "rgba(255,255,255,.015)", border: item ? "1px solid rgba(234,187,96,.18)" : "1px dashed rgba(237,211,164,.12)" }}>
                      <div style={{ width: 24, height: 38, display: "grid", placeItems: "center" }}>{item ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ color: "rgba(241,224,194,.22)", fontSize: 14 }}>{SLOT_ICONS[slot]}</span>}</div>
                      <div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: item ? "#ead7b9" : "rgba(238,222,194,.28)", fontSize: 8.5 }}>{SLOT_LABELS[slot]}</strong><span style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(238,222,194,.34)", fontSize: 7.4 }}>{item?.displayName ?? "Trống"}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 30 }}>
            <div><strong style={{ color: "#efc979", fontSize: 12.5 }}>Trong túi</strong><span style={{ marginLeft: 6, color: "rgba(247,233,210,.48)", fontSize: 10 }}>· {ownedWearables.length} wearable · {achievements.length} thành quả</span></div>
            <span style={{ color: "rgba(247,233,210,.42)", fontSize: 9 }}>Một loại thành quả chỉ giữ cấp hiện tại cao nhất</span>
          </div>

          <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gridTemplateRows: `repeat(${rows},minmax(0,1fr))`, gap: 9 }}>
            {inventoryItems.map((item) => {
              const active = selected?.id === item.id;
              return (
                <article key={item.id} style={{ position: "relative", minHeight: 0, overflow: "hidden", borderRadius: 16, padding: "8px 8px 7px", display: "grid", gridTemplateRows: "1fr auto", gap: 5, background: active ? "linear-gradient(180deg,rgba(88,60,38,.95),rgba(52,34,25,.97))" : item.kind === "achievement" ? "linear-gradient(180deg,rgba(54,39,28,.82),rgba(31,22,18,.88))" : "linear-gradient(180deg,rgba(51,36,29,.72),rgba(32,22,19,.8))", border: active ? "1px solid rgba(250,207,116,.84)" : item.kind === "achievement" ? "1px solid rgba(226,179,84,.2)" : "1px solid rgba(236,195,116,.13)", boxShadow: active ? "0 10px 28px rgba(226,177,82,.11)" : "0 9px 22px rgba(0,0,0,.07)" }}>
                  {item.equipped ? <span style={{ position: "absolute", right: 7, top: 7, zIndex: 4, padding: "3px 6px", borderRadius: 99, background: "#e4bd68", color: "#2a1b12", fontSize: 6.8, fontWeight: 950, letterSpacing: ".04em" }}>ĐANG MANG</span> : null}
                  {item.kind === "achievement" ? <span style={{ position: "absolute", left: 7, top: 7, zIndex: 4, padding: "3px 6px", borderRadius: 99, background: "rgba(54,36,27,.88)", border: "1px solid rgba(233,191,106,.25)", color: "#ebc879", fontSize: 6.8, fontWeight: 950 }}>CẤP {levelRoman(item.level)}</span> : null}
                  <div style={{ minHeight: 0, display: "grid", placeItems: "center", borderRadius: 12, background: item.kind === "achievement" ? "radial-gradient(circle,rgba(239,199,113,.105),transparent 67%)" : "radial-gradient(circle,rgba(255,226,169,.07),transparent 66%)" }}>
                    <img src={item.imageUrl} alt="" draggable={false} style={{ width: item.kind === "achievement" ? "74%" : "88%", height: item.kind === "achievement" ? "74%" : "88%", objectFit: "contain", filter: active ? "drop-shadow(0 8px 12px rgba(0,0,0,.28)) brightness(1.06)" : "drop-shadow(0 6px 9px rgba(0,0,0,.22))" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 9.5, lineHeight: 1.14, color: active ? "#ffe0a0" : "#ede0cc" }}>{item.displayName}</strong>
                    <span style={{ display: "block", marginTop: 3, color: item.kind === "achievement" ? "#d6ae5e" : "rgba(235,219,192,.4)", fontSize: 7.7, fontWeight: 850 }}>{item.kind === "achievement" ? `${item.achievementKind === "badge" ? "HUY HIỆU" : "THÀNH QUẢ"} · CẤP ${levelRoman(item.level)}` : SLOT_LABELS[item.slot]}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ minHeight: 76, borderRadius: 18, border: "1px solid rgba(239,196,112,.17)", background: "rgba(29,19,16,.76)", padding: "11px 15px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 18, boxShadow: "0 12px 28px rgba(0,0,0,.12)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15.5, color: "#f0c878" }}>{selected?.displayName ?? "Túi hành trang"}</strong>{selected?.kind === "achievement" ? <span style={{ color: "#e8bd69", fontSize: 9, fontWeight: 950 }}>CẤP {levelRoman(selected.level)} / {levelRoman(selected.maxLevel)}</span> : null}</div>
              <div style={{ marginTop: 4, color: "rgba(247,235,215,.47)", fontSize: 9.5 }}>{selected?.kind === "achievement" ? `${selected.description} Cấp thấp hơn được thay thế khi con tiến bộ.` : selected ? `Đã sở hữu · ${SLOT_LABELS[selected.slot]}. Staff có thể trang bị món này cho Piner.` : "Tất cả đồ con sở hữu đều ở đây."}</div>
            </div>
            {selected ? <div style={{ minWidth: 142, padding: "10px 14px", borderRadius: 13, textAlign: "center", background: selected.equipped ? "rgba(77,112,65,.18)" : "rgba(218,166,69,.12)", border: selected.equipped ? "1px solid rgba(141,196,117,.3)" : "1px solid rgba(236,187,89,.24)", color: selected.equipped ? "#a7d694" : "#f2ca76", fontWeight: 950, fontSize: 11.5 }}>{selected.equipped ? "Đang trang bị" : "Có thể trang bị"}<span style={{ display: "block", marginTop: 3, color: "rgba(245,226,193,.38)", fontSize: 7.7, fontWeight: 700 }}>Staff thao tác trên điện thoại</span></div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
