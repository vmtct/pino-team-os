import type { CSSProperties } from "react";

export type PinoriaCharacterConfig = Record<string, string>;

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
  return ["back", "outfit", "body", "hair", "face", "headwear", "eyewear"]
    .some((key) => pinoriaAssetUrl(source[key]) !== null);
}

export function LayeredCharacter({
  config,
  className,
  style,
}: {
  config: PinoriaCharacterConfig;
  className?: string;
  style?: CSSProperties;
}) {
  if (!hasRenderableCharacterConfig(config)) {
    return <div className={className} style={{ ...style, display: "grid", placeItems: "center" }} data-character-state="invalid" role="img" aria-label="Nhân vật chưa sẵn sàng"><span>Nhân vật chưa sẵn sàng</span></div>;
  }
  const ordered = [
    config.back,
    config.outfit ?? config.body,
    config.hair,
    config.face,
    config.headwear,
    config.eyewear,
  ];
  return <div className={className} style={style}>
    {ordered.map((value, index) => {
      const src = pinoriaAssetUrl(value);
      return src ? <img key={`${index}:${src}`} src={src} alt="" draggable={false} /> : null;
    })}
  </div>;
}