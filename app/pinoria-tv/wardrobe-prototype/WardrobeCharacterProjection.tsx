"use client";
/* eslint-disable @next/next/no-img-element -- staging projection composes transparent Pinoria assets */
import { useEffect, useRef } from "react";
import { LayeredCharacter, type PinoriaCharacterConfig } from "../layered-character";
import styles from "./wardrobe-character-projection.module.css";

type AccessoryVisual = {
  id: string;
  imageUrl?: string;
  level?: number;
};

const AURA = "https://assets.pinohouse.art/draft/AuraLv3.png";
const COMPANION = "https://assets.pinohouse.art/draft/Mori.png";
const MARKS = [
  "https://assets.pinohouse.art/draft/Mark/Char%20Base%20(2).png",
  "https://assets.pinohouse.art/draft/Mark/Char%20Base%20(3).png",
  "https://assets.pinohouse.art/draft/Mark/Char%20Base%20(4).png",
] as const;
const GLOWS = [
  { src: "https://assets.pinohouse.art/draft/glowViolet1.png", mirrored: false },
  { src: "https://assets.pinohouse.art/draft/glowViolet2.png", mirrored: false },
  { src: "https://assets.pinohouse.art/draft/glowViolet1.png", mirrored: true },
  { src: "https://assets.pinohouse.art/draft/glowViolet2.png", mirrored: true },
] as const;
const ACCESSORY_ASSETS = {
  brush: "https://assets.pinohouse.art/draft/Pinoria_accessories1.png",
  scroll: "https://assets.pinohouse.art/draft/Pinoria_accessories2.png",
  palette: "https://assets.pinohouse.art/draft/Pinoria_accessories3.png",
  maker: "https://assets.pinohouse.art/draft/Pinoria_accessories4.png",
} as const;

// Mirrors the standardized staging Bơ fixture: all 8 slots visible, two equipped.
const ACCESSORIES: AccessoryVisual[] = [
  { id: "achievement-brush-l2", imageUrl: ACCESSORY_ASSETS.brush, level: 2 },
  { id: "achievement-palette-l2", imageUrl: ACCESSORY_ASSETS.palette, level: 2 },
  { id: "achievement-3" },
  { id: "achievement-4" },
  { id: "achievement-5" },
  { id: "achievement-6" },
  { id: "achievement-7" },
  { id: "achievement-8" },
];

function roman(level?: number) {
  if (!level) return null;
  return ["", "I", "II", "III", "IV", "V"][level] ?? String(level);
}

function AccessorySlot({ item, index }: { item: AccessoryVisual; index: number }) {
  const level = roman(item.level);
  return <div
    className={`${styles.accessorySlot} ${item.imageUrl ? styles.accessoryFilled : styles.accessoryEmpty}`}
    data-character-accessory-slot={index + 1}
  >
    {item.imageUrl
      ? <img src={item.imageUrl} alt="" draggable={false} />
      : <span aria-hidden="true">✦</span>}
    {level ? <b>{level}</b> : null}
  </div>;
}

function AccessoryRail({ side }: { side: "left" | "right" }) {
  const start = side === "left" ? 0 : 4;
  return <div
    className={`${styles.accessoryRail} ${styles[side]}`}
    data-character-accessory-rail={side}
  >
    {ACCESSORIES.slice(start, start + 4).map((item, index) => (
      <AccessorySlot key={item.id} item={item} index={start + index} />
    ))}
  </div>;
}

function OrbitingMarks({ celebrate }: { celebrate: boolean }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const markRefs = useRef<Array<HTMLImageElement | null>>([]);
  useEffect(() => {
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const periodMs = celebrate ? 7200 : 12600;

    const renderFrame = (now: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) {
        frame = requestAnimationFrame(renderFrame);
        return;
      }

      const size = Math.min(82, width * .15);
      const centerX = width * .5;
      const centerY = height * .61;
      const radiusX = Math.min(190, width * .34);
      const radiusY = Math.min(66, height * .12);
      const base = reducedMotion ? 0 : ((now % periodMs) / periodMs) * Math.PI * 2;

      MARKS.forEach((_, index) => {
        const element = markRefs.current[index];
        if (!element) return;
        const angle = base + index * Math.PI * 2 / 3;
        const sin = Math.sin(angle);
        const depth = (sin + 1) / 2;
        const frontHalf = sin >= 0;
        const x = centerX + radiusX * Math.cos(angle) - size / 2;
        const y = centerY + radiusY * sin - size / 2;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.transform = `translate3d(${x}px,${y}px,0) scale(${.88 + depth * .15})`;
        element.style.opacity = `${.58 + depth * .36}`;
        element.style.zIndex = frontHalf ? "36" : "12";
        element.style.filter = `brightness(${.91 + depth * .16}) blur(${(1 - depth) * .7}px) drop-shadow(0 8px 13px rgba(0,0,0,.18))`;
        element.dataset.pinoriaCharacterOrbitDepth = frontHalf ? "front" : "behind";
      });
      if (!reducedMotion) frame = requestAnimationFrame(renderFrame);
    };

    frame = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(frame);
  }, [celebrate]);

  return <div ref={stageRef} className={styles.marks} data-pinoria-character-effect="marks">
    {MARKS.map((src, index) => <img
      key={src}
      ref={(node) => { markRefs.current[index] = node; }}
      data-pinoria-character-orbit-mark={index + 1}
      src={src}
      alt=""
      draggable={false}
    />)}
  </div>;
}

export function WardrobeCharacterProjection({
  config,
  celebrate,
}: {
  config: PinoriaCharacterConfig;
  celebrate: boolean;
}) {
  return <div className={styles.stage} data-pinoria-standard-projection>
    <img className={styles.auraBack} data-pinoria-character-effect="aura-back" src={AURA} alt="" />
    <div className={styles.auraGround} data-pinoria-character-effect="aura-ground" />
    <OrbitingMarks celebrate={celebrate} />
    <div className={styles.glows} data-pinoria-character-effect="glows">
      {GLOWS.map((glow, index) => <img
        key={`${glow.src}:${index}`}
        className={glow.mirrored ? styles.mirrored : undefined}
        src={glow.src}
        alt=""
        draggable={false}
      />)}
    </div>
    <AccessoryRail side="left" />
    <div className={styles.characterCore} data-pinoria-character-core>
      <LayeredCharacter config={config} className={styles.character} />
    </div>
    <div className={styles.companion} data-pinoria-character-companion aria-label="Mori">
      <div className={styles.companionHalo} />
      <img src={COMPANION} alt="" draggable={false} />
    </div>
    <AccessoryRail side="right" />
  </div>;
}
