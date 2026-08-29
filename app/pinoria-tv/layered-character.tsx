import type { CSSProperties } from "react";

export type PinoriaCharacterConfig = Record<string, string>;

export function pinoriaAssetUrl(path: string | null | undefined) {
  const value = path?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://assets.pinohouse.art/${value.replace(/^\/+/, "")}`;
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