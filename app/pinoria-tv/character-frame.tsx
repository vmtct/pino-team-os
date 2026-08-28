import type { CSSProperties, ReactNode } from "react";
import { JourneyRankPanel } from "./journey-rank";
import { prototypeFloatingProps } from "./prototype-assets";
import type { InventoryAchievementSlot, InventoryEquipmentState } from "./shop-types";

export const CHARACTER_ACCESSORY_SLOTS: readonly InventoryAchievementSlot[] = [
  "achievement-1", "achievement-2", "achievement-3", "achievement-4",
  "achievement-5", "achievement-6", "achievement-7", "achievement-8",
];

type CharacterAccessoryVisual = {
  id: string;
  imageUrl?: string;
  level?: number;
};

const ACHIEVEMENT_VISUALS = [
  ["achievement-brush", prototypeFloatingProps[0]?.src],
  ["achievement-scroll", prototypeFloatingProps[1]?.src],
  ["achievement-palette", prototypeFloatingProps[2]?.src],
  ["achievement-maker", prototypeFloatingProps[3]?.src],
] as const;

const MOCK_EQUIPPED: Record<string, Partial<Record<InventoryAchievementSlot, string>>> = {
  bo: { "achievement-1": "achievement-brush-l2", "achievement-2": "achievement-palette-l2" },
  tri: { "achievement-1": "achievement-scroll-l3", "achievement-2": "achievement-maker-l2" },
  an: { "achievement-1": "achievement-brush-l3", "achievement-2": "achievement-palette-l2" },
  mai: { "achievement-1": "achievement-brush-l1" },
};function visualFromId(id?: string): CharacterAccessoryVisual | undefined {
  if (!id) return undefined;
  const levelMatch = id.match(/-l(\d+)$/);
  const level = levelMatch ? Number(levelMatch[1]) : undefined;
  const family = ACHIEVEMENT_VISUALS.find(([prefix]) => id.startsWith(prefix));
  return { id, imageUrl: family?.[1], level };
}

export function characterAccessoriesFromEquipment(equipment?: InventoryEquipmentState): CharacterAccessoryVisual[] {
  return CHARACTER_ACCESSORY_SLOTS.map((slot) => visualFromId(equipment?.achievements?.[slot]) ?? { id: slot });
}

export function mockCharacterAccessories(subjectId: string): CharacterAccessoryVisual[] {
  const equipment = MOCK_EQUIPPED[subjectId] ?? {};
  return CHARACTER_ACCESSORY_SLOTS.map((slot) => visualFromId(equipment[slot]) ?? { id: slot });
}

export function activatedMarkIdsFromEarned(earned: string[] = []) {
  const ids: string[] = [];
  if (earned.some((id) => id.startsWith("badge-artchitect-"))) ids.push("mark-02");
  if (earned.some((id) => id.startsWith("badge-pianohouse-"))) ids.push("mark-03");
  if (earned.some((id) => id.startsWith("badge-house-helper-"))) ids.push("mark-04");
  return ids;
}

function roman(level?: number) {
  if (!level) return null;
  return ["", "I", "II", "III", "IV", "V"][level] ?? String(level);
}function AccessorySlot({ item, index }: { item?: CharacterAccessoryVisual; index: number }) {
  const empty = !item?.imageUrl;
  const level = roman(item?.level);
  return (
    <div data-character-accessory-slot={index + 1} style={{ position: "relative", width: "clamp(46px,4vw,58px)", aspectRatio: "1 / 1", borderRadius: 14, display: "grid", placeItems: "center", background: empty ? "rgba(255,255,255,.012)" : "radial-gradient(circle,rgba(240,198,111,.1),rgba(42,28,23,.78) 70%)", border: empty ? "1px dashed rgba(238,208,153,.14)" : "1px solid rgba(236,191,104,.23)", boxShadow: empty ? undefined : "0 9px 22px rgba(0,0,0,.15),inset 0 0 16px rgba(234,188,95,.04)" }}>
      {item?.imageUrl ? <img src={item.imageUrl} alt="" draggable={false} style={{ width: "80%", height: "80%", objectFit: "contain", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.24))" }} /> : <span style={{ color: "rgba(242,225,194,.13)", fontSize: 13 }}>✦</span>}
      {level ? <span style={{ position: "absolute", right: -2, bottom: -2, minWidth: 17, height: 17, padding: "0 4px", display: "grid", placeItems: "center", borderRadius: 99, background: "#d7ab55", border: "2px solid #281a15", color: "#281a15", fontSize: 6.5, fontWeight: 950 }}>{level}</span> : null}
    </div>
  );
}

function AccessoryRail({ items, side }: { items: CharacterAccessoryVisual[]; side: "left" | "right" }) {
  return (
    <div data-character-accessory-rail={side} style={{ position: "absolute", [side]: "clamp(8px,1.2vw,18px)", top: "50%", transform: "translateY(-48%)", display: "grid", gridTemplateRows: "repeat(4,clamp(46px,4vw,58px))", gap: "clamp(7px,.8vw,10px)", zIndex: 28 }}>
      {items.map((item, index) => <AccessorySlot key={`${side}:${item.id}:${index}`} item={item} index={side === "left" ? index : index + 4} />)}
    </div>
  );
}

type CharacterFrameProps = {
  subjectId: string;
  subjectName: string;
  accessories?: CharacterAccessoryVisual[];
  children: ReactNode;
  companion?: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
  stageStyle?: CSSProperties;
  identityStyle?: CSSProperties;
};export function PinoriaCharacterFrame({ subjectId, subjectName, accessories, children, companion, footer, style, stageStyle, identityStyle }: CharacterFrameProps) {
  const slots = accessories?.length === 8 ? accessories : mockCharacterAccessories(subjectId);
  return (
    <div data-pinoria-character-frame style={{ position: "relative", height: "100%", minHeight: 0, display: "grid", gridTemplateRows: footer ? "auto minmax(0,1fr) auto" : "auto minmax(0,1fr)", ...style }}>
      <JourneyRankPanel subjectId={subjectId} subjectName={subjectName} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 11px", borderBottom: "1px solid rgba(236,199,126,.09)", ...identityStyle }} />
      <div data-pinoria-character-stage style={{ position: "relative", minHeight: 0, display: "grid", placeItems: "center", ...stageStyle }}>
        <AccessoryRail side="left" items={slots.slice(0, 4)} />
        <div data-pinoria-character-core style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", placeItems: "center" }}>
          {children}
        </div>
        <AccessoryRail side="right" items={slots.slice(4, 8)} />
        {companion}
      </div>
      {footer}
    </div>
  );
}
