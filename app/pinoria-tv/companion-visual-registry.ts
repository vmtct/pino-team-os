export type CompanionVisualDefinition = {
  id: string;
  src: string;
  mediaType?: "image" | "video";
  fallbackSrc?: string;
  canvas: { width: number; height: number };
  scale: number;
  translateYPercent: number;
  filter?: string;
};

const APPROVED_PLOO_BASE = "https://assets.pinohouse.art/draft/Mori.png";
const MORI_ANIMATION = "https://assets.pinohouse.art/pinoria/Companion/Mori%20Animation.webm";

const DEFAULT_VISUAL_ID = "ploo-form-2";

export const companionVisualRegistry: Readonly<Record<string, CompanionVisualDefinition>> = {
  "ploo-form-1": {
    id: "ploo-form-1",
    src: APPROVED_PLOO_BASE,
    canvas: { width: 1487, height: 1487 },
    scale: .84,
    translateYPercent: 6,
    filter: "saturate(.86) brightness(.96)",
  },
  "ploo-form-2": {
    id: "ploo-form-2",
    src: MORI_ANIMATION,
    mediaType: "video",
    fallbackSrc: APPROVED_PLOO_BASE,
    canvas: { width: 1487, height: 1487 },
    scale: 1,
    translateYPercent: 0,
  },  // Backward-compatible aliases while old prototype snapshots still exist.
  "ploo-default": {
    id: "ploo-form-2",
    src: MORI_ANIMATION,
    mediaType: "video",
    fallbackSrc: APPROVED_PLOO_BASE,
    canvas: { width: 1487, height: 1487 },
    scale: 1,
    translateYPercent: 0,
  },
  "mori-v1": {
    id: "ploo-form-2",
    src: MORI_ANIMATION,
    mediaType: "video",
    fallbackSrc: APPROVED_PLOO_BASE,
    canvas: { width: 1487, height: 1487 },
    scale: 1,
    translateYPercent: 0,
  },
};

export function resolveCompanionVisual(requestedVisualId?: string | null) {
  const requested = requestedVisualId?.trim() || DEFAULT_VISUAL_ID;
  const resolved = companionVisualRegistry[requested] ?? companionVisualRegistry[DEFAULT_VISUAL_ID];
  return {
    requestedVisualId: requested,
    resolvedVisualId: resolved.id,
    definition: resolved,
    usedFallback: !companionVisualRegistry[requested],
  };
}