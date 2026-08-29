export type WishRevealRarity = "COMMON" | "RARE" | "MYTHIC";
export type WishRevealSource = "FEATURED" | "OFF_BANNER" | "RARE_POOL" | "COMMON_POOL";
export type WishRevealKind = "PERFECT_MEMORY" | "FEATURED_MEMORY" | "WEARABLE" | "VARIANT" | "DUPLICATE";

export type WishRevealItem = {
  id: string;
  key: string;
  displayName: string;
  slot: "HEADWEAR" | "WINGS" | "OUTFIT";
  rarity: WishRevealRarity;
  layerAssetKey?: string;
};

export type WishRevealPull = {
  pullIndex: number;
  rarity: WishRevealRarity;
  source: WishRevealSource;
  revealKind: WishRevealKind;
  resonanceBefore: number;
  resonanceAfter: number;
  setProgressAfter: { owned: number; total: 3 };
  wearables: WishRevealItem[];
  variantIds: string[];
  entitlementIds: string[];
};
export type WishRevealProjection = {
  schemaVersion: 1;
  revealId: string;
  drawId: string;
  centerId: string;
  visitId: string;
  subject: {
    studentProfileId: string;
    displayName: string;
    character: { id: string; config: Record<string, string> };
  };
  banner: {
    id: string;
    key: string;
    displayName: string;
    storyHook: string;
    heroAssetKey: string;
    regionKey: string;
    bearer: { id: string; key: string; displayName: string; title: string };
    signatureSet: { id: string; key: string; displayName: string; pieces: WishRevealItem[] };
  };
  pulls: WishRevealPull[];
};

export type ClaimedWishReveal = {
  projection: WishRevealProjection;
  claimedAt: string;
};

export const PINORIA_WISH_REVEAL_URL = "/api/pinoria-prototype/wish-reveal";
export const PINORIA_WISH_REVEAL_DEMO_URL = "/api/pinoria-prototype/wish-reveal-demo";
export const PINORIA_WISH_SURFACE_CENTER = "RECEPTION_TV";
