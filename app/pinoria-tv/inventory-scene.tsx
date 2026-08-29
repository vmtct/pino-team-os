"use client";

import { useEffect, useMemo, useState } from "react";
import { AMBIENT_HOUSE_ARRIVAL_ASSETS } from "./arrival-visual-config";
import { EggWaterCompanion } from "./egg-water-companion";
import { CharacterCompanionAnchor, PinoriaCharacterFrame, activatedMarkIdsFromEarned, characterAccessoriesFromEquipment } from "./character-frame";
import {
  PrototypeCharacter,
  PrototypeCompanion,
  prototypeFloatingProps,
  type PrototypeCharacterLayerOverrides,
  type PrototypeCharacterSlot,
} from "./prototype-assets";
import {
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_LOGO,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  type InventoryFilter,
  type InventoryWearableSlot,
  type ShopCatalogItem,
  type ShopSessionSnapshot,
} from "./shop-types";

const WEARABLE_SLOTS: readonly InventoryWearableSlot[] = ["hair", "face", "headwear", "eyewear", "back", "body"];
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

function WearableSlot({ slot, imageUrl }: { slot: InventoryWearableSlot; imageUrl?: string }) {
  const empty = !imageUrl;
  return (
    <div
      title={SLOT_LABELS[slot]}
      aria-label={empty ? `${SLOT_LABELS[slot]} trống` : `${SLOT_LABELS[slot]} đang mang`}
      style={{
        width: 58,
        height: 58,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        background: empty ? "rgba(255,255,255,.012)" : "radial-gradient(circle,rgba(240,198,111,.085),rgba(45,30,24,.72) 72%)",
        border: empty ? "1px dashed rgba(237,211,164,.12)" : "1px solid rgba(234,187,96,.19)",
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} style={{ width: "84%", height: "84%", objectFit: "contain", filter: "drop-shadow(0 5px 7px rgba(0,0,0,.18))" }} />
      ) : (
        <span style={{ color: "rgba(241,224,194,.17)", fontSize: 16 }}>{SLOT_ICONS[slot]}</span>
      )}
    </div>
  );
}

export function InventoryScene({ surfaceId = PINORIA_SHOP_SURFACE_ID, companionVariant = "default" }: { surfaceId?: string; companionVariant?: "default" | "egg-water" }) {
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

  const achievements = useMemo(
    () => (session?.earnedAchievementIds ?? [])
      .map(achievementFromId)
      .filter((item): item is AchievementItem => !!item && item.kind === "artifact"),
    [session],
  );

  const activatedMarkIds = activatedMarkIdsFromEarned(session?.earnedAchievementIds);
  const characterAccessories = characterAccessoriesFromEquipment(session?.equipment);

  const inventoryItems = useMemo<InventoryItem[]>(() => {
    const equippedWearableIds = new Set(Object.values(session?.equipment?.wearables ?? {}));
    const equippedAchievementIds = new Set(Object.values(session?.equipment?.achievements ?? {}));
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

  const inventoryFilter: InventoryFilter = session?.inventoryFilter ?? "outfit";
  const filteredInventoryItems = useMemo(
    () => inventoryItems.filter((item) => inventoryFilter === "outfit"
      ? item.kind === "wearable" && item.slot === "body"
      : item.kind === "achievement" || (item.kind === "wearable" && item.slot !== "body")),
    [inventoryFilter, inventoryItems],
  );
  const selected = filteredInventoryItems.find((item) => item.id === session?.inventorySelectedId) ?? filteredInventoryItems[0];
  const sparseInventory = filteredInventoryItems.length <= 2;
  const inventoryColumns = filteredInventoryItems.length <= 10 ? 5 : filteredInventoryItems.length <= 14 ? 7 : filteredInventoryItems.length > 28 ? 9 : 8;
  const visibleEquippedSlots = inventoryFilter === "outfit" ? (["body"] as const) : WEARABLE_SLOTS.filter((slot) => slot !== "body");

  const layerOverrides = useMemo<PrototypeCharacterLayerOverrides | undefined>(() => {
    if (!catalog.length || !session) return undefined;
    const overrides: PrototypeCharacterLayerOverrides = {};
    for (const slot of WEARABLE_SLOTS) {
      const assetId = session.equipment?.wearables?.[slot];
      const item = assetId ? catalog.find((candidate) => candidate.assetId === assetId) : undefined;
      if (!assetId) overrides[slot as PrototypeCharacterSlot] = null;
      else if (item?.layerUrl) overrides[slot as PrototypeCharacterSlot] = { layerUrl: item.layerUrl, animateUrl: item.animateUrl };
    }
    return overrides;
  }, [catalog, session]);

  const equipmentCount = Object.keys(session?.equipment?.wearables ?? {}).length + Object.keys(session?.equipment?.achievements ?? {}).length;

  async function setInventoryFilter(filter: InventoryFilter) {
    try {
      const response = await fetch(PINORIA_SHOP_RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceId, op: "set-inventory-filter", filter }),
      });
      const data = await response.json() as { session?: ShopSessionSnapshot };
      if (response.ok && data.session) setSession(data.session);
    } catch {
      // Review surface keeps the last shared state if the relay pauses.
    }
  }

  return (
    <div data-pinoria-inventory-scene style={{ position: "absolute", inset: 0, overflow: "hidden", color: "#f6ead7", background: "#1b1411" }}>
      <HouseInventoryBackdrop />
      <style>{`
        @keyframes pinoriaInventoryEnter { from { opacity:0; transform:scale(1.008) } to { opacity:1; transform:scale(1) } }
        @keyframes pinoriaInventorySelected { 0% { box-shadow:0 0 0 rgba(235,188,91,0) } 50% { box-shadow:0 0 28px rgba(235,188,91,.18) } 100% { box-shadow:0 0 18px rgba(235,188,91,.1) } }
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

          <div data-inventory-filter-rail style={{ justifySelf: "center", width: "min(720px,100%)", minHeight: 58, padding: 6, borderRadius: 19, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, background: "rgba(39,27,21,.72)", border: "1px solid rgba(239,199,120,.16)", boxShadow: "0 14px 34px rgba(0,0,0,.16)" }}>
            {([['outfit','Trang phục','♢'],['accessory','Phụ Kiện','✦']] as const).map(([id,label,icon]) => {
              const active = inventoryFilter === id;
              return <button key={id} type="button" data-inventory-filter={id} data-active={active ? "true" : "false"} onClick={() => void setInventoryFilter(id)} style={{ minWidth: 0, borderRadius: 14, border: active ? "1px solid rgba(255,232,178,.52)" : "1px solid transparent", background: active ? "linear-gradient(180deg,#f5d486,#d6a84e)" : "rgba(255,255,255,.025)", color: active ? "#2a1b12" : "rgba(246,232,208,.64)", display: "grid", gridTemplateColumns: "22px auto", placeContent: "center", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 950, letterSpacing: ".015em", boxShadow: active ? "0 10px 24px rgba(210,160,65,.2), inset 0 1px rgba(255,255,255,.35)" : undefined, cursor: "pointer" }}><span style={{ fontSize: 16 }}>{icon}</span>{label}</button>;
            })}
          </div>

          <div style={{ display: "grid", justifyItems: "end", gap: 3 }}>
            <span style={{ color: "#efc875", fontSize: 11, fontWeight: 900, textAlign: "right", lineHeight: 1.25 }}>✦ {equipmentCount} đang trang bị</span>
            <span style={{ color: "rgba(239,200,117,.58)", fontSize: 9.5 }}>{activatedMarkIds.length} dấu ấn tự kích hoạt</span>
          </div>
        </header>

        <section style={{ position: "relative", minHeight: 0, borderRadius: 26, overflow: "hidden", border: "1px solid rgba(236,194,115,.2)", background: "linear-gradient(180deg,rgba(46,30,25,.61),rgba(24,16,14,.78))", boxShadow: "0 30px 60px rgba(0,0,0,.27)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 52% 42%,rgba(143,78,195,.13),transparent 52%)" }} />
          <PinoriaCharacterFrame
            subjectId={session?.subject.id ?? "bo"}
            subjectName={session?.subject.name ?? "Bơ"}
            accessories={characterAccessories}
            style={{ padding: "12px 16px 15px" }}
            footer={inventoryFilter === "outfit" ? undefined : <div style={{ borderRadius: 17, padding: "9px 12px 11px", background: "rgba(19,12,10,.7)", border: "1px solid rgba(240,196,112,.16)" }}><div style={{ marginBottom: 7, color: "rgba(243,229,204,.4)", fontSize: 8.2, fontWeight: 950, letterSpacing: ".12em" }}>PHỤ KIỆN ĐANG DÙNG</div><div style={{ display: "grid", gridTemplateColumns: `repeat(${visibleEquippedSlots.length},58px)`, justifyContent: "center", gap: 8 }}>{visibleEquippedSlots.map((slot) => { const assetId = session?.equipment?.wearables?.[slot]; const item = assetId ? catalog.find((candidate) => candidate.assetId === assetId) : undefined; return <WearableSlot key={slot} slot={slot} imageUrl={item?.imageUrl} />; })}</div></div>}
          >
            <div style={{ position: "relative", width: "min(440px,34vw,56vh)", aspectRatio: "1 / 1", display: "grid", placeItems: "center" }}>
              <PrototypeCharacter subjectId={session?.subject.id ?? "bo"} motion="shop-preview" layerOverrides={layerOverrides} prestigeMarkIds={activatedMarkIds} size="100%" style={{ filter: "drop-shadow(0 19px 22px rgba(0,0,0,.2))" }} />
              <CharacterCompanionAnchor surface="inventory">{companionVariant === "egg-water" ? <EggWaterCompanion size="100%" /> : <PrototypeCompanion size="100%" style={{ filter: "drop-shadow(0 20px 20px rgba(0,0,0,.42)) drop-shadow(0 7px 8px rgba(0,0,0,.28))" }} />}</CharacterCompanionAnchor>
            </div>
          </PinoriaCharacterFrame>        </section>

        <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 30 }}>
            <div><strong style={{ color: "#efc979", fontSize: 12.5 }}>{inventoryFilter === "outfit" ? "Trang phục" : "Phụ Kiện"}</strong><span style={{ marginLeft: 6, color: "rgba(247,233,210,.48)", fontSize: 10 }}>· {filteredInventoryItems.length} món</span></div>
            <span style={{ color: "rgba(247,233,210,.42)", fontSize: 9 }}>Chỉ vào món con muốn dùng</span>
          </div>

          <div data-inventory-grid data-filter={inventoryFilter} data-layout={sparseInventory ? "sparse" : "dense"} style={{ minHeight: 0, display: "grid", gridTemplateColumns: sparseInventory ? `repeat(${Math.max(1, filteredInventoryItems.length)},minmax(210px,240px))` : `repeat(${inventoryColumns},minmax(0,1fr))`, justifyContent: "start", alignContent: "start", gap: 8 }}>
            {filteredInventoryItems.map((item) => {
              const active = selected?.id === item.id;
              return (
                <article
                  key={item.id}
                  data-inventory-item
                  data-kind={item.kind}
                  data-slot={item.kind === "wearable" ? item.slot : "achievement"}
                  aria-label={item.displayName}
                  style={{
                    position: "relative",
                    minWidth: 0,
                    aspectRatio: "1 / 1",
                    overflow: "hidden",
                    borderRadius: 14,
                    padding: 6,
                    display: "grid",
                    placeItems: "center",
                    background: active
                      ? "linear-gradient(180deg,rgba(91,61,38,.95),rgba(52,34,25,.98))"
                      : item.kind === "achievement"
                        ? "linear-gradient(180deg,rgba(54,39,28,.8),rgba(31,22,18,.88))"
                        : "linear-gradient(180deg,rgba(51,36,29,.7),rgba(32,22,19,.8))",
                    border: active
                      ? "1px solid rgba(250,207,116,.88)"
                      : item.equipped
                        ? "1px solid rgba(158,204,137,.28)"
                        : item.kind === "achievement"
                          ? "1px solid rgba(226,179,84,.18)"
                          : "1px solid rgba(236,195,116,.12)",
                    boxShadow: item.equipped ? "inset 0 0 0 1px rgba(155,205,137,.08)" : "0 7px 18px rgba(0,0,0,.06)",
                    animation: active ? "pinoriaInventorySelected .42s ease-out both" : undefined,
                  }}
                >
                  {item.kind === "achievement" ? (
                    <span style={{ position: "absolute", left: 6, top: 6, zIndex: 4, minWidth: 18, height: 18, padding: "0 3px", display: "grid", placeItems: "center", borderRadius: 99, background: "rgba(49,33,25,.9)", border: "1px solid rgba(233,191,106,.22)", color: "#e9c477", fontSize: 6.8, fontWeight: 950 }}>
                      {levelRoman(item.level)}
                    </span>
                  ) : null}
                  <img
                    src={item.imageUrl}
                    alt=""
                    draggable={false}
                    style={{
                      width: item.kind === "achievement" ? "76%" : "88%",
                      height: item.kind === "achievement" ? "76%" : "88%",
                      objectFit: "contain",
                      filter: active ? "drop-shadow(0 8px 12px rgba(0,0,0,.28)) brightness(1.07)" : "drop-shadow(0 5px 8px rgba(0,0,0,.2))",
                    }}
                  />
                </article>
              );
            })}
          </div>

          <div style={{ minHeight: 70, borderRadius: 18, border: "1px solid rgba(239,196,112,.17)", background: "rgba(29,19,16,.76)", padding: "10px 15px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 18, boxShadow: "0 12px 28px rgba(0,0,0,.12)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 18, color: "#f0c878" }}>{selected?.displayName ?? "Chỉ vào một món trong túi"}</strong>
                {selected?.kind === "achievement" ? <span style={{ color: "#e8bd69", fontSize: 9, fontWeight: 950 }}>CẤP {levelRoman(selected.level)}</span> : null}
              </div>
              <div style={{ marginTop: 4, color: "rgba(247,235,215,.52)", fontSize: 11 }}>
                {selected?.kind === "achievement"
                  ? `${selected.description} Staff có thể đặt thành quả này vào một ô đang mang.`
                  : selected
                    ? `Đã sở hữu · ${SLOT_LABELS[selected.slot]}. Staff có thể trang bị món này cho Piner.`
                    : "Staff chọn đúng món con đang chỉ trên TV để xem chi tiết."}
              </div>
            </div>
            {selected ? (
              <div style={{ minWidth: 138, padding: "9px 13px", borderRadius: 13, textAlign: "center", background: selected.equipped ? "rgba(77,112,65,.16)" : "rgba(218,166,69,.11)", border: selected.equipped ? "1px solid rgba(141,196,117,.27)" : "1px solid rgba(236,187,89,.22)", color: selected.equipped ? "#a7d694" : "#f2ca76", fontWeight: 950, fontSize: 11 }}>
                {selected.equipped ? "Đang dùng" : "Trang bị"}
                <span style={{ display: "block", marginTop: 3, color: "rgba(245,226,193,.34)", fontSize: 7.5, fontWeight: 700 }}>Staff thao tác trên điện thoại</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
