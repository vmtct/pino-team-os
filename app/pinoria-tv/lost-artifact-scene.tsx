"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type { LostArtifactRecord } from "./lost-artifact-data";
import styles from "./lost-artifact.module.css";

const UI_ASSET_BASE = process.env.NEXT_PUBLIC_PINORIA_LOST_ARTIFACT_ASSET_BASE?.replace(/\/$/, "");

export const LOST_ARTIFACT_BROADCAST_MS = 13_500;

function uiAsset(name: string) {
  return UI_ASSET_BASE
    ? `${UI_ASSET_BASE}/${name}`
    : `/api/pinoria-prototype/lost-artifact-ui?asset=${encodeURIComponent(name)}`;
}

const ICONS = {
  divider: uiAsset("lost-artifact-divider.png"),
  corner: uiAsset("lost-artifact-frame-corner.png"),
  artifactId: uiAsset("meta-artifact-id.png"),
  origin: uiAsset("meta-origin.png"),
  classification: uiAsset("meta-classification.png"),
  lastSeen: uiAsset("meta-last-seen.png"),
  history: uiAsset("section-history.png"),
  power1: uiAsset("power-rune-01.png"),
  power2: uiAsset("power-rune-02.png"),
  power3: uiAsset("power-rune-03.png"),
} as const;

type Palette = {
  primary: string;
  secondary: string;
  glow: string;
  dark: string;
  primaryRgb: string;
  secondaryRgb: string;
};

const FALLBACK: Palette = {
  primary: "hsl(40 48% 66%)",
  secondary: "hsl(158 25% 64%)",
  glow: "hsl(40 72% 84%)",
  dark: "hsl(30 28% 8%)",
  primaryRgb: "205 174 122",
  secondaryRgb: "145 184 168",
};

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s, l };
}

function paletteFromPixels(data: Uint8ClampedArray): Palette | null {
  const buckets = Array.from({ length: 24 }, () => ({ r: 0, g: 0, b: 0, w: 0, score: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 48) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hsl = rgbToHsl(r, g, b);
    if (hsl.l < 0.12 || hsl.l > 0.97) continue;
    const weight = (0.4 + hsl.s * 1.8) * (0.55 + a / 255);
    const index = Math.min(23, Math.floor(hsl.h / 15));
    const bucket = buckets[index];
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    bucket.w += weight;
    bucket.score += weight * (0.65 + Math.min(hsl.l, 0.82));
  }
  const ranked = buckets
    .map((bucket, index) => ({ ...bucket, index }))
    .filter((bucket) => bucket.w > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const first = ranked[0];
  const second = ranked.find((candidate) => {
    const d = Math.abs(candidate.index - first.index);
    return Math.min(d, 24 - d) >= 3;
  }) ?? ranked[1] ?? first;

  const tune = (bucket: typeof first, saturationFloor: number, lightness: number) => {
    const r = Math.round(bucket.r / bucket.w);
    const g = Math.round(bucket.g / bucket.w);
    const b = Math.round(bucket.b / bucket.w);
    const hsl = rgbToHsl(r, g, b);
    const s = Math.max(saturationFloor, Math.min(0.78, hsl.s * 1.12));
    return { css: `hsl(${Math.round(hsl.h)} ${Math.round(s * 100)}% ${Math.round(lightness * 100)}%)`, h: hsl.h, r, g, b };
  };

  const p = tune(first, 0.42, 0.66);
  const s = tune(second, 0.34, 0.70);
  return {
    primary: p.css,
    secondary: s.css,
    glow: `hsl(${Math.round(p.h)} 74% 84%)`,
    dark: `hsl(${Math.round(p.h)} 34% 8%)`,
    primaryRgb: `${p.r} ${p.g} ${p.b}`,
    secondaryRgb: `${s.r} ${s.g} ${s.b}`,
  };
}

function useArtifactPalette(src: string) {
  const [palette, setPalette] = useState<Palette>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.clearRect(0, 0, 48, 48);
        ctx.drawImage(image, 0, 0, 48, 48);
        const next = paletteFromPixels(ctx.getImageData(0, 0, 48, 48).data);
        if (!cancelled && next) setPalette(next);
      } catch {
        if (!cancelled) setPalette(FALLBACK);
      }
    };
    image.onerror = () => !cancelled && setPalette(FALLBACK);
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return palette;
}

function MaskIcon({ src, className = "" }: { src: string; className?: string }) {
  const style = {
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
  } as CSSProperties;
  return <span className={`${styles.maskIcon} ${className}`} style={style} aria-hidden="true" />;
}

export function LostArtifactScene({ artifact }: { artifact: LostArtifactRecord }) {
  const heroSrc = `/api/pinoria-prototype/lost-artifact-image?id=${encodeURIComponent(artifact.id)}`;
  const palette = useArtifactPalette(heroSrc);
  const themeStyle = useMemo(
    () => ({
      "--artifact-primary": palette.primary,
      "--artifact-secondary": palette.secondary,
      "--artifact-glow": palette.glow,
      "--artifact-dark": palette.dark,
      "--artifact-primary-rgb": palette.primaryRgb,
      "--artifact-secondary-rgb": palette.secondaryRgb,
    }) as CSSProperties,
    [palette],
  );

  const metadata = [
    { label: "MÃ DI VẬT", value: artifact.code, icon: ICONS.artifactId },
    { label: "NGUỒN GỐC", value: artifact.origin, icon: ICONS.origin },
    { label: "PHÂN LOẠI", value: artifact.classification, icon: ICONS.classification },
    { label: "LẦN CUỐI GHI NHẬN", value: artifact.lastSeen, icon: ICONS.lastSeen },
  ];
  const powerIcons = [ICONS.power1, ICONS.power2, ICONS.power3] as const;

  return (
    <section className={styles.scene} style={themeStyle} data-lost-artifact={artifact.id}>
      <div className={styles.background} />
      <div className={styles.heroAura} />
      <div className={styles.vignette} />
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <MaskIcon key={corner} src={ICONS.corner} className={`${styles.corner} ${styles[corner]}`} />
      ))}

      <header className={styles.brand}>
        <span className={styles.brandSigil}>✦</span>
        <strong>PINORIA</strong>
        <small>TV</small>
      </header>

      <div className={styles.heroStage}>
        <div className={styles.heroRings}><i /><i /><i /></div>
        <img className={styles.heroImage} src={heroSrc} alt={artifact.title} />
      </div>

      <aside className={styles.huntPanel}>
        <div className={styles.huntSigil}><i /><i /><b /></div>
        <div>
          <h2>TRUY TÌM ĐANG HOẠT ĐỘNG</h2>
          <p><b>DẤU VẾT CUỐI CÙNG</b><span>{artifact.clue}</span></p>
          <p><b>TÍN HIỆU CỘNG HƯỞNG</b><span>{artifact.signal}</span></p>
          <small>Nếu nhận ra dư âm này, hãy báo về Pinoria House.</small>
        </div>
      </aside>

      <main className={styles.dossier}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>THẦN KHÍ THẤT LẠC</span>
          <h1>{artifact.title}</h1>
          <MaskIcon src={ICONS.divider} className={styles.divider} />
        </div>

        <section className={styles.metaGrid}>
          {metadata.map((item) => (
            <div key={item.label} className={styles.metaItem}>
              <MaskIcon src={item.icon} className={styles.metaIcon} />
              <div><small>{item.label}</small><strong>{item.value}</strong></div>
            </div>
          ))}
        </section>

        <section className={`${styles.panel} ${styles.historyPanel}`}>
          <div className={styles.panelHeading}>
            <MaskIcon src={ICONS.history} className={styles.headingIcon} />
            <h2>LỊCH SỬ</h2>
          </div>
          <p>{artifact.history[0]}</p>
          <p>{artifact.history[1]}</p>
          <strong className={styles.clue}>✦ {artifact.clue}</strong>
        </section>

        <section className={`${styles.panel} ${styles.powersPanel}`}>
          <div className={styles.panelHeading}><span className={styles.miniRune}>✦</span><h2>SỨC MẠNH THẦN KỲ</h2></div>
          <div className={styles.powerGrid}>
            {artifact.powers.map((power, index) => (
              <article key={power.name}>
                <MaskIcon src={powerIcons[index]} className={styles.powerIcon} />
                <h3>{power.name}</h3>
                <p>{power.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.bountyPanel}>
          <div className={styles.pinoriumMark}><span>P</span></div>
          <div className={styles.bountyCopy}>
            <small>TREO THƯỞNG</small>
            <strong>{artifact.bounty.toLocaleString("en-US")}</strong>
            <b>PINORIUM</b>
            <p>Thưởng cho người đầu tiên xác nhận và hộ tống thần khí trở về Pinoria House.</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>PINORIA HOUSE · TRUYỀN TIN THẾ GIỚI</footer>
    </section>
  );
}
