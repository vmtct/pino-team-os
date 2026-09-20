import type { CSSProperties } from "react";
import { resolvePinoriaEffectPresentation, type PinoriaEffectPresentationKey } from "../../lib/pinoria-effect-presentation";

export type PinoriaCharacterConfig = Record<string, string>;
export type PinoriaEffectSurface = "FULL_AVATAR" | "HOUSE_MINI";
export type PinoriaWardSlot = "HEAD/HAIR" | "FACE" | "HEADWEAR" | "OUTFIT" | "BACK" | "AURA_BACK" | "AURA_GROUND" | "PATH_MARK";
export type PinoriaWardRenderVariant = {
  slot: PinoriaWardSlot;
  variantId: string;
  renderMode: "LAYER" | "STANDALONE" | "WEBM";
  assetKey: string | null;
  posterAssetKey: string | null;
  renderMetadata: unknown;
};
export type PinoriaWardRender = {
  mode: "LAYERED" | "SET_WEBM";
  webmAssetKey: string | null;
  variants: PinoriaWardRenderVariant[];
};
type ResolvedLayer = {
  key: string;
  slot: PinoriaWardSlot | "EYEWEAR";
  src: string;
  media: "IMAGE" | "VIDEO";
  poster: string | null;
  loop: boolean;
  style?: CSSProperties;
};

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

const BASE_LAYER_ORDER: Array<{ slot: PinoriaWardSlot | "EYEWEAR"; source: (config: PinoriaCharacterConfig) => string | undefined; zIndex: number }> = [
  { slot: "BACK", source: (config) => config.back, zIndex: 10 },
  { slot: "OUTFIT", source: (config) => config.outfit ?? config.body, zIndex: 20 },
  { slot: "HEAD/HAIR", source: (config) => config.hair, zIndex: 30 },
  { slot: "FACE", source: (config) => config.face, zIndex: 40 },
  { slot: "HEADWEAR", source: (config) => config.headwear, zIndex: 50 },
  { slot: "EYEWEAR", source: (config) => config.eyewear, zIndex: 60 },
];
const EFFECT_SLOTS = new Set<PinoriaWardSlot>(["AURA_BACK","AURA_GROUND","PATH_MARK"]);

function renderMetadataStyle(value: unknown, fallbackZ: number): CSSProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { zIndex: fallbackZ };
  const row = value as Record<string, unknown>;
  const offset = row.offset && typeof row.offset === "object" && !Array.isArray(row.offset) ? row.offset as Record<string, unknown> : null;
  const offsetX = typeof row.offsetX === "number" ? row.offsetX : typeof offset?.x === "number" ? offset.x : 0;
  const offsetY = typeof row.offsetY === "number" ? row.offsetY : typeof offset?.y === "number" ? offset.y : 0;
  const scale = typeof row.scale === "number" ? row.scale : 1;
  const rotation = typeof row.rotation === "number" ? row.rotation : 0;
  const zIndex = Number.isSafeInteger(row.zIndex) ? Number(row.zIndex) : fallbackZ;
  return { position: "absolute", inset: 0, zIndex, transform: `translate(${offsetX}px,${offsetY}px) scale(${scale}) rotate(${rotation}deg)`, transformOrigin: "50% 50%" };
}

function resolvedLayeredLayers(config: PinoriaCharacterConfig, wardRender: PinoriaWardRender | null | undefined): ResolvedLayer[] {
  const bySlot = new Map((wardRender?.variants ?? []).map((variant) => [variant.slot, variant]));
  const layers: ResolvedLayer[] = [];
  for (const base of BASE_LAYER_ORDER) {
    if (base.slot !== "EYEWEAR") {
      const variant = bySlot.get(base.slot);
      const asset = pinoriaAssetUrl(variant?.assetKey);
      if (asset) {
        layers.push({
          key: `ward:${variant!.variantId}`,
          slot: variant!.slot,
          src: asset,
          media: variant!.renderMode === "WEBM" ? "VIDEO" : "IMAGE",
          poster: variant!.renderMode === "WEBM" ? pinoriaAssetUrl(variant!.posterAssetKey) : null,
          loop: variant!.renderMode === "WEBM" && Boolean((variant!.renderMetadata as Record<string, unknown> | null)?.loop),
          style: renderMetadataStyle(variant!.renderMetadata, base.zIndex),
        });
        continue;
      }
    }
    const src = pinoriaAssetUrl(base.source(config));
    if (src) layers.push({ key: `base:${base.slot}`, slot: base.slot, src, media: "IMAGE", poster: null, loop: false, style: { zIndex: base.zIndex } });
  }
  for (const variant of wardRender?.variants ?? []) {
    if (!EFFECT_SLOTS.has(variant.slot)) continue;
    const src = pinoriaAssetUrl(variant.assetKey);
    if (src) layers.push({
      key: `ward:${variant.variantId}`,
      slot: variant.slot,
      src,
      media: variant.renderMode === "WEBM" ? "VIDEO" : "IMAGE",
      poster: variant.renderMode === "WEBM" ? pinoriaAssetUrl(variant.posterAssetKey) : null,
      loop: variant.renderMode === "WEBM" && Boolean((variant.renderMetadata as Record<string, unknown> | null)?.loop),
      style: renderMetadataStyle(variant.renderMetadata, variant.slot === "AURA_BACK" ? 8 : variant.slot === "AURA_GROUND" ? 5 : 6),
    });
  }
  return layers.sort((a,b) => Number(a.style?.zIndex ?? 0) - Number(b.style?.zIndex ?? 0));
}

export function LayeredCharacter({
  config,
  className,
  style,
  effectKey = null,
  effectSurface = "FULL_AVATAR",
  wardRender = null,
}: {
  config: PinoriaCharacterConfig;
  className?: string;
  style?: CSSProperties;
  effectKey?: string | null;
  effectSurface?: PinoriaEffectSurface;
  wardRender?: PinoriaWardRender | null;
}) {
  if (!hasRenderableCharacterConfig(config)) {
    return <div className={className} style={{ ...style, display: "grid", placeItems: "center" }} data-character-state="invalid" role="img" aria-label="Nhân vật chưa sẵn sàng"><span>Nhân vật chưa sẵn sàng</span></div>;
  }
  const layers = resolvedLayeredLayers(config, wardRender);
  const setWebm = wardRender?.mode === "SET_WEBM" ? pinoriaAssetUrl(wardRender.webmAssetKey) : null;
  const effect = resolvePinoriaEffectPresentation(effectKey);
  if (!effect) return <NormalLayers className={className} style={style} layers={layers} setWebm={setWebm} />;

  return <div className={className} style={style} data-pinoria-effect={effect.key} data-effect-surface={effectSurface} data-ward-render-mode={wardRender?.mode ?? "BASE"}>
    <EffectStyles />
    {effect.key === "RAINBOW" && !setWebm
      ? <RainbowLayers layers={layers} surface={effectSurface} />
      : <NormalLayersInner layers={layers} setWebm={setWebm} effectKey={effect.key} surface={effectSurface} />}
  </div>;
}

function LayerMedia({ layer, rainbow = false }: { layer: ResolvedLayer; rainbow?: boolean }) {
  const wardId = layer.key.startsWith("ward:") ? layer.key.slice(5) : undefined;
  if (layer.media === "VIDEO") {
    return <video
      key={layer.key}
      src={layer.src}
      poster={layer.poster ?? undefined}
      autoPlay
      loop={layer.loop}
      muted
      playsInline
      data-ward-layer={wardId}
      data-ward-media="WEBM"
      className={rainbow ? "pino-effect-rainbow-video" : undefined}
      style={{ ...layer.style, width: "100%", height: "100%", objectFit: "contain" }}
    />;
  }
  return <img key={layer.key} src={layer.src} alt="" draggable={false} style={layer.style} data-ward-layer={wardId} />;
}

function NormalLayers({ className, style, layers, setWebm }: { className?: string; style?: CSSProperties; layers: ResolvedLayer[]; setWebm: string | null }) {
  return <div className={className} style={style} data-ward-render-mode={setWebm ? "SET_WEBM" : "LAYERED"}>
    {setWebm ? <video src={setWebm} autoPlay loop muted playsInline data-ward-set-webm style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 20 }} /> : null}
    {layers.filter((layer) => !setWebm || (layer.slot !== "EYEWEAR" && EFFECT_SLOTS.has(layer.slot))).map((layer) => <LayerMedia key={layer.key} layer={layer} />)}
  </div>;
}

function NormalLayersInner({ layers, setWebm, effectKey, surface }: { layers: ResolvedLayer[]; setWebm: string | null; effectKey: PinoriaEffectPresentationKey; surface: PinoriaEffectSurface }) {
  const frameScale = surface === "FULL_AVATAR" ? effectKey === "GIANT" ? 1.14 : effectKey === "TINY" ? 0.72 : 1 : 1;
  const className = effectKey === "GHOST" ? "pino-effect-ghost-frame" : undefined;
  const filter = effectKey === "GHOST" ? "opacity(.62) saturate(.62) drop-shadow(0 0 10px rgba(190,235,255,.7))" : undefined;
  return <div className={className} style={{ position: "absolute", inset: 0, transform: `scale(${frameScale})`, transformOrigin: "50% 75%", filter }}>
    {setWebm ? <video src={setWebm} autoPlay loop muted playsInline data-ward-set-webm style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 20 }} /> : null}
    {layers.filter((layer) => !setWebm || (layer.slot !== "EYEWEAR" && EFFECT_SLOTS.has(layer.slot))).map((layer) => <LayerMedia key={layer.key} layer={layer} />)}
  </div>;
}

function RainbowLayers({ layers, surface }: { layers: ResolvedLayer[]; surface: PinoriaEffectSurface }) {
  return <div className="pino-effect-rainbow-frame" data-rainbow-layer-count={layers.length} style={{ position: "absolute", inset: 0 }}>
    {layers.map((layer) => layer.media === "VIDEO"
      ? <LayerMedia key={layer.key} layer={layer} rainbow />
      : <span
          key={layer.key}
          className="pino-effect-rainbow-layer"
          data-rainbow-source={layer.src}
          data-ward-layer={layer.key.startsWith("ward:") ? layer.key.slice(5) : undefined}
          style={{
            position: "absolute", inset: 0, display: "block",
            left: 0, top: 0, maxWidth: "none", padding: 0, borderRadius: 0, overflow: "visible",
            transform: layer.style?.transform ?? "none", zIndex: layer.style?.zIndex,
            WebkitMaskImage: `url(${JSON.stringify(layer.src)})`, maskImage: `url(${JSON.stringify(layer.src)})`,
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
