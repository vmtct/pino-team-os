import type { CSSProperties } from "react";
import { resolvePinoriaEffectPresentation, type PinoriaEffectPresentationKey } from "../../lib/pinoria-effect-presentation";

export type PinoriaCharacterConfig = Record<string, string>;
export type PinoriaEffectSurface = "FULL_AVATAR" | "HOUSE_MINI";

export function pinoriaAssetUrl(path: unknown) {
  if (typeof path !== "string") return null;
  const value = path.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://assets.pinohouse.art/${value.replace(/^\/+/, "")}`;
}

export function hasRenderableCharacterConfig(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const source = config as Record<string, unknown>;
  return ["hair", "face", "outfit"].every((key) => pinoriaAssetUrl(source[key]) !== null);
}

function orderedLayerUrls(config: PinoriaCharacterConfig) {
  return [config.back, config.outfit ?? config.body, config.hair, config.face, config.headwear, config.eyewear]
    .map(pinoriaAssetUrl)
    .filter((value): value is string => value !== null);
}

export function LayeredCharacter({
  config,
  className,
  style,
  effectKey = null,
  effectSurface = "FULL_AVATAR",
}: {
  config: PinoriaCharacterConfig;
  className?: string;
  style?: CSSProperties;
  effectKey?: string | null;
  effectSurface?: PinoriaEffectSurface;
}) {
  if (!hasRenderableCharacterConfig(config)) {
    return <div className={className} style={{ ...style, display: "grid", placeItems: "center" }} data-character-state="invalid" role="img" aria-label="Nhân vật chưa sẵn sàng"><span>Nhân vật chưa sẵn sàng</span></div>;
  }
  const layers = orderedLayerUrls(config);
  const effect = resolvePinoriaEffectPresentation(effectKey);
  if (!effect) return <NormalLayers className={className} style={style} layers={layers} />;

  return <div className={className} style={style} data-pinoria-effect={effect.key} data-effect-surface={effectSurface}>
    <EffectStyles />
    {effect.key === "RAINBOW"
      ? <RainbowLayers layers={layers} surface={effectSurface} />
      : <NormalLayersInner layers={layers} effectKey={effect.key} surface={effectSurface} />}
  </div>;
}

function NormalLayers({ className, style, layers }: { className?: string; style?: CSSProperties; layers: string[] }) {
  return <div className={className} style={style}>{layers.map((src, index) => <img key={`${index}:${src}`} src={src} alt="" draggable={false} />)}</div>;
}

function NormalLayersInner({ layers, effectKey, surface }: { layers: string[]; effectKey: PinoriaEffectPresentationKey; surface: PinoriaEffectSurface }) {
  const frameScale = surface === "FULL_AVATAR" ? effectKey === "GIANT" ? 1.14 : effectKey === "TINY" ? 0.72 : 1 : 1;
  const className = effectKey === "GHOST" ? "pino-effect-ghost-frame" : undefined;
  const filter = effectKey === "GHOST" ? "opacity(.62) saturate(.62) drop-shadow(0 0 10px rgba(190,235,255,.7))" : undefined;
  return <div className={className} style={{ position: "absolute", inset: 0, transform: `scale(${frameScale})`, transformOrigin: "50% 75%" }}>
    {layers.map((src, index) => <img key={`${index}:${src}`} src={src} alt="" draggable={false} style={filter ? { filter } : undefined} />)}
  </div>;
}

function RainbowLayers({ layers, surface }: { layers: string[]; surface: PinoriaEffectSurface }) {
  return <div className="pino-effect-rainbow-frame" data-rainbow-layer-count={layers.length} style={{ position: "absolute", inset: 0 }}>
    {layers.map((src, index) => <span
      key={`${index}:${src}`}
      className="pino-effect-rainbow-layer"
      data-rainbow-source={src}
      style={{
        position: "absolute", inset: 0, display: "block",
        WebkitMaskImage: `url(${JSON.stringify(src)})`, maskImage: `url(${JSON.stringify(src)})`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskPosition: "center", maskPosition: "center",
        WebkitMaskSize: "contain", maskSize: "contain",
        backgroundImage: "linear-gradient(115deg,#ff4d6d 0%,#ffb703 18%,#80ed99 36%,#48cae4 54%,#9d4edd 72%,#ff4d6d 100%)",
        backgroundSize: surface === "HOUSE_MINI" ? "240% 240%" : "320% 320%",
      }}
    />)}
  </div>;
}

function EffectStyles() {
  return <style>{`
    @keyframes pino-rainbow-shift { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
    @keyframes pino-ghost-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6%); } }
    .pino-effect-rainbow-layer { animation: pino-rainbow-shift 2.8s linear infinite; filter: drop-shadow(0 0 5px rgba(255,255,255,.28)); }
    .pino-effect-ghost-frame { animation: pino-ghost-float 2.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .pino-effect-rainbow-layer,.pino-effect-ghost-frame { animation: none !important; } }
  `}</style>;
}
