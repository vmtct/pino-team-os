export type ShopCategoryId = "all" | "hair" | "face" | "headwear" | "eyewear" | "back" | "body" | "prop";
export type PinoriaStoreView = "shop" | "inventory";
export type PinoriaSurfaceBaseMode = "ambient" | "arrival" | "choice" | "ritual" | "reward" | "learning" | "broadcast" | "world-transition" | "departure";
export type PinoriaSurfaceEffectiveMode = PinoriaSurfaceBaseMode | PinoriaStoreView;
export type InventoryWearableSlot = "back" | "body" | "hair" | "face" | "headwear" | "eyewear";
export type InventoryAchievementSlot =
  | "achievement-1"
  | "achievement-2"
  | "achievement-3"
  | "achievement-4"
  | "achievement-5"
  | "achievement-6"
  | "achievement-7"
  | "achievement-8";

export type EnergySeedRewardKind =
  | "wearable"
  | "companion-item"
  | "fruit"
  | "pls"
  | "utility"
  | "mirror-ticket";

export type EnergySeedReward = {
  id: string;
  kind: EnergySeedRewardKind;
  label: string;
  detail?: string;
  amount?: number;
  imageUrl?: string;
  region?: string;
};

export type LearningSpotlightProgram = "artchitect" | "pianohouse" | "little-piner" | "toppi" | "house";
export type LearningSpotlightKind = "skill" | "performance" | "project" | "achievement";
export type LearningSpotlightPayload = {
  id: string;
  program: LearningSpotlightProgram;
  kind: LearningSpotlightKind;
  milestoneLabel: string;
  detail: string;
  previousLabel?: string;
  nextLabel?: string;
  evidenceLabel?: string;
};

export type WorldBroadcastKind = "world-update" | "campaign" | "discovery" | "companion" | "community" | "lost-artifact";
export type WorldBroadcastScope = "pinoria" | "house";
export type WorldBroadcastPayload = {
  id: string;
  kind: WorldBroadcastKind;
  scope: WorldBroadcastScope;
  eyebrow: string;
  title: string;
  detail: string;
  regionLabel?: string;
  chapterLabel?: string;
  artifactId?: string;
  footer?: string;
};

export type PinoriaWorldAmbientTheme = "neutral" | "verdant" | "tide" | "terravia" | "ember";
export type PinoriaWorldStateSnapshot = {
  id: string;
  revision: number;
  regionLabel: string;
  chapterLabel: string;
  seasonLabel: string;
  ambientTheme: PinoriaWorldAmbientTheme;
  updatedAt: number;
};

export type WorldStateTransitionPayload = {
  id: string;
  title: string;
  detail: string;
  from: PinoriaWorldStateSnapshot;
  to: PinoriaWorldStateSnapshot;
  footer?: string;
};

export const DEFAULT_PINORIA_WORLD_STATE: PinoriaWorldStateSnapshot = {
  id: "terravia-chapter-i",
  revision: 1,
  regionLabel: "Terravia",
  chapterLabel: "Chương I",
  seasonLabel: "Mùa Thu",
  ambientTheme: "terravia",
  updatedAt: 0,
};

export type ShopCatalogItem = {
  assetId: string;
  slug: string;
  version: string;
  displayName: string;
  family: string;
  slot: string;
  category: ShopCategoryId;
  gender: string;
  registrationProfile: string;
  imageUrl: string;
  layerUrl?: string;
  pricePls: number;
  previewable: boolean;
  attention?: "hot" | "featured" | "new";
};

export type ShopSubject = {
  id: string;
  name: string;
  pls: number;
};

export type ShopPurchaseResult = {
  id: number;
  assetId: string;
  status: "purchased" | "already-owned" | "insufficient-pls";
  at: number;
};

export type InventoryEquipmentState = {
  wearables: Partial<Record<InventoryWearableSlot, string>>;
  achievements: Partial<Record<InventoryAchievementSlot, string>>;
};

export type ShopSessionSnapshot = {
  surfaceId: string;
  open: boolean;
  view: PinoriaStoreView;
  subject: ShopSubject;
  category: ShopCategoryId;
  selectedAssetId: string | null;
  pendingPurchaseAssetId: string | null;
  ownedAssetIds: string[];
  earnedAchievementIds: string[];
  inventorySelectedId: string | null;
  equipment: InventoryEquipmentState;
  purchaseResult: ShopPurchaseResult | null;
  updatedAt: number;
};

export type PinoriaSurfaceInteractiveSnapshot = {
  view: PinoriaStoreView;
  subjectId: string;
  subjectName: string;
  openedAt: number;
  updatedAt: number;
};

export type PinoriaSurfaceSessionSnapshot = {
  surfaceId: string;
  online: boolean;
  baseMode: PinoriaSurfaceBaseMode;
  effectiveMode: PinoriaSurfaceEffectiveMode;
  lastSeenAt: number | null;
  subjectId: string | null;
  subjectName: string | null;
  interactive: PinoriaSurfaceInteractiveSnapshot | null;
  interactiveSuspended: boolean;
  worldState: PinoriaWorldStateSnapshot;
  updatedAt: number;
};

// Shop is intentionally cosmetic-only. Props/artifacts/badges are earned
// learning achievements and live in Túi Hành Trang instead of being purchasable.
export const PINORIA_SHOP_CATEGORIES: readonly { id: ShopCategoryId; label: string; icon: string }[] = [
  { id: "all", label: "Tất cả", icon: "✦" },
  { id: "hair", label: "Tóc", icon: "◒" },
  { id: "face", label: "Mặt", icon: "☺" },
  { id: "headwear", label: "Nón", icon: "⌒" },
  { id: "eyewear", label: "Kính", icon: "◎" },
  { id: "back", label: "Cánh", icon: "◇" },
  { id: "body", label: "Trang phục", icon: "♢" },
] as const;

export const PINORIA_SHOP_LOGO = "https://assets.pinohouse.art/pinoria/Pinoria%20Logo.png";
export const PINORIA_SHOP_SURFACE_ID = "RECEPTION_TV";
export const PINORIA_SHOP_RELAY_URL = "/api/pinoria-prototype/shop-relay";
export const PINORIA_SHOP_CATALOG_URL = "/api/pinoria-prototype/shop-catalog";
export const PINORIA_SURFACE_SESSION_URL = "/api/pinoria-prototype/surface-session";

export function categoryForAsset(slot: string | null | undefined, family: string | null | undefined): ShopCategoryId | null {
  if (slot === "hair" || slot === "face" || slot === "headwear" || slot === "eyewear" || slot === "back" || slot === "body") return slot;
  // Earned props/artifacts must never leak back into the PLS Shop catalog.
  if (family === "prop" || family === "artifact") return null;
  return null;
}

export function categoryLabel(category: ShopCategoryId) {
  return PINORIA_SHOP_CATEGORIES.find((item) => item.id === category)?.label ?? "Tất cả";
}
