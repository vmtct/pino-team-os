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

export function wardRenderTransformStyle(metadata: unknown) {
  const root = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  const transform = root.transform && typeof root.transform === "object" ? root.transform as Record<string, unknown> : {};
  const anchor = root.anchor && typeof root.anchor === "object" ? root.anchor as Record<string, unknown> : {};
  const number = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const offsetX = number(transform.offsetX, 0), offsetY = number(transform.offsetY, 0), scale = number(transform.scale, 1), rotation = number(transform.rotation, 0);
  const anchorX = number(anchor.x, 50), anchorY = number(anchor.y, 50);
  return { transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rotation}deg)`, transformOrigin: `${anchorX}% ${anchorY}%` };
}
