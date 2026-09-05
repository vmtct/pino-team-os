export type WardSlot = "HEAD/HAIR" | "FACE" | "HEADWEAR" | "OUTFIT" | "BACK" | "AURA_BACK" | "AURA_GROUND" | "PATH_MARK";

export type WardSessionCandidate = {
  id: string;
  key: string;
  displayName: string;
  wearableName: string;
  slot: WardSlot;
  rarity: string;
  render: {
    mode: "LAYER" | "STANDALONE" | "WEBM";
    assetKey: string | null;
    posterAssetKey: string | null;
    metadata: unknown;
  };
};

export type WardSession = {
  id: string;
  visitId: string;
  studentProfileId: string;
  centerId: string;
  policyVersion: string;
  loadoutVersionBefore: number;
  wardrobeVersionBefore: number;
  status: "OPEN" | "SELECTED";
  candidates: [WardSessionCandidate, WardSessionCandidate, WardSessionCandidate];
  selectedVariantId: string | null;
  selectedAt: string | null;
  loadoutVersionAfter: number | null;
  createdAt: string;
  version: number;
};

export type WardSessionEnvelope<T> = { data?: T; error?: { code?: string; message?: string } };

export function wardAssetUrl(path: string | null) {
  if (!path) return null;
  const value = path.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://assets.pinohouse.art/${value.replace(/^\/+/, "")}`;
}
