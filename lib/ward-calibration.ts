export type WardRenderMode = "LAYER" | "STANDALONE" | "WEBM";

export type WardCalibration = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  zIndex: number;
  baseOpacity: number;
  baseVisible: boolean;
};

export const DEFAULT_WARD_CALIBRATION: WardCalibration = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  zIndex: 60,
  baseOpacity: 0.32,
  baseVisible: true,
};

const ALLOWED_METADATA = new Set([
  "anchor", "zIndex", "offset", "offsetX", "offsetY", "scale", "rotation",
  "occlusionGroup", "compatibilityTags", "loop",
]);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function wardAssetUrl(assetKey: string | null | undefined) {
  const value = assetKey?.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://assets.pinohouse.art/${value.replace(/^\/+/, "")}`;
}

export function readWardCalibration(metadata: Record<string, unknown>): WardCalibration {
  const canonicalOffset = object(metadata.offset);
  const legacyTransform = object(metadata.transform);
  const legacyLayer = object(metadata.layer);
  return {
    ...DEFAULT_WARD_CALIBRATION,
    offsetX: finite(metadata.offsetX, finite(canonicalOffset.x, finite(legacyTransform.offsetX, 0))),
    offsetY: finite(metadata.offsetY, finite(canonicalOffset.y, finite(legacyTransform.offsetY, 0))),
    scale: finite(metadata.scale, finite(legacyTransform.scale, 1)),
    rotation: finite(metadata.rotation, finite(legacyTransform.rotation, 0)),
    zIndex: finite(metadata.zIndex, finite(legacyLayer.zIndex, 60)),
  };
}

export function buildWardRenderMetadata(
  existing: Record<string, unknown>,
  mode: WardRenderMode,
  calibration: WardCalibration,
  loop: boolean,
) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (ALLOWED_METADATA.has(key)) next[key] = value;
  }
  next.offsetX = calibration.offsetX;
  next.offsetY = calibration.offsetY;
  next.scale = calibration.scale;
  next.rotation = calibration.rotation;
  next.zIndex = Math.trunc(calibration.zIndex);
  if (mode === "LAYER") next.anchor = typeof next.anchor === "string" && next.anchor.trim() ? next.anchor : "character";
  if (mode === "WEBM") next.loop = loop;
  else delete next.loop;
  return next;
}
