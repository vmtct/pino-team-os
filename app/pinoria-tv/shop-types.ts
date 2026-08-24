export type ShopCategoryId = "all" | "hair" | "face" | "headwear" | "eyewear" | "back" | "body" | "prop";
export type PinoriaStoreView = "shop" | "inventory";
export type InventoryWearableSlot = "back" | "body" | "hair" | "face" | "headwear" | "eyewear";
export type InventoryAchievementSlot = "artifact-1" | "artifact-2" | "badge";

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

export const PINORIA_SHOP_CATEGORIES: readonly { id: ShopCategoryId; label: string; icon: string }[] = [
  { id: "all", label: "Tất cả", icon: "✦" },
  { id: "hair", label: "Tóc", icon: "◒" },
  { id: "face", label: "Mặt", icon: "☺" },
  { id: "headwear", label: "Nón", icon: "⌒" },
  { id: "eyewear", label: "Kính", icon: "◎" },
  { id: "back", label: "Cánh", icon: "◇" },
  { id: "body", label: "Trang phục", icon: "♢" },
  { id: "prop", label: "Đạo cụ", icon: "✧" },
] as const;

export const PINORIA_SHOP_LOGO = "https://assets.pinohouse.art/pinoria/Pinoria%20Logo.png";
export const PINORIA_SHOP_SURFACE_ID = "RECEPTION_TV";
export const PINORIA_SHOP_RELAY_URL = "/api/pinoria-prototype/shop-relay";
export const PINORIA_SHOP_CATALOG_URL = "/api/pinoria-prototype/shop-catalog";

export function categoryForAsset(slot: string | null | undefined, family: string | null | undefined): ShopCategoryId | null {
  if (slot === "hair" || slot === "face" || slot === "headwear" || slot === "eyewear" || slot === "back" || slot === "body") return slot;
  if (family === "prop" || family === "artifact") return "prop";
  return null;
}

export function categoryLabel(category: ShopCategoryId) {
  return PINORIA_SHOP_CATEGORIES.find((item) => item.id === category)?.label ?? "Tất cả";
}
