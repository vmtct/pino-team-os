export const PINORIA_EFFECT_PRESENTATION_KEYS = ["RAINBOW", "GIANT", "TINY", "GHOST"] as const;

export type PinoriaEffectPresentationKey = (typeof PINORIA_EFFECT_PRESENTATION_KEYS)[number];

export type PinoriaEffectPresentation = {
  key: PinoriaEffectPresentationKey;
  houseScale: number;
  speedMultiplier: number;
  spectral: boolean;
  floating: boolean;
  rainbowSilhouette: boolean;
};

const PRESENTATIONS: Record<PinoriaEffectPresentationKey, PinoriaEffectPresentation> = {
  RAINBOW: { key: "RAINBOW", houseScale: 1, speedMultiplier: 1, spectral: false, floating: false, rainbowSilhouette: true },
  GIANT: { key: "GIANT", houseScale: 2, speedMultiplier: 0.55, spectral: false, floating: false, rainbowSilhouette: false },
  TINY: { key: "TINY", houseScale: 0.45, speedMultiplier: 1.45, spectral: false, floating: false, rainbowSilhouette: false },
  GHOST: { key: "GHOST", houseScale: 1, speedMultiplier: 1, spectral: true, floating: true, rainbowSilhouette: false },
};

export function resolvePinoriaEffectPresentation(key: string | null | undefined): PinoriaEffectPresentation | null {
  if (!key) return null;
  return PRESENTATIONS[key as PinoriaEffectPresentationKey] ?? null;
}
