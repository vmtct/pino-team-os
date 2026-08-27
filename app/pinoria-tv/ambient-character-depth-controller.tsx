"use client";

import { useEffect } from "react";

const MINI_CENTER_X = 82;
const MINI_CENTER_Y = 57.5;

// Keep the explicit House MID cut stronger than char-to-char depth ordering.
// Within each MID plane, larger visual Y must always render in front.
const Z_BACK = 0;
const Z_BEHIND_BASE = 1_000;
const Z_MID = 500_000_000;
const Z_FRONT_BASE = 600_000_000;
const Z_HOUSE_FRONT = 1_100_000_000;
const Z_EDITOR_OVERLAY = 1_200_000_000;

function setImportantZ(element: HTMLElement, zIndex: number) {
  const next = String(zIndex);
  if (
    element.style.getPropertyValue("z-index") === next
    && element.style.getPropertyPriority("z-index") === "important"
  ) return;
  element.style.setProperty("z-index", next, "important");
}

function numberFromPx(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Pseudo-3D character depth for Ambient House.
 *
 * Rule:
 * - explicit BEHIND/FRONT MID remains the primary occlusion plane;
 * - inside either plane, a character with larger current Y renders above one
 *   with smaller current Y;
 * - connector movement naturally follows interpolated current Y because React
 *   continuously updates the mini-character top position;
 * - X is only a deterministic tie-break when Y is effectively equal;
 * - exact Y/X ties fall back to DOM order, which is stable by agent id.
 *
 * This controller intentionally operates on the rendered prototype so the rule
 * applies to both test placement and SIMULATE GRAPH ×10 without changing the
 * saved motion-graph data format.
 */
export function AmbientCharacterDepthController() {
  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const mid = document.querySelector('img[src*="layer=mid"]') as HTMLImageElement | null;
      const front = document.querySelector('img[src*="layer=front"]') as HTMLImageElement | null;
      const back = document.querySelector('img[src*="layer=back"]') as HTMLImageElement | null;

      if (mid?.parentElement) {
        const stage = mid.parentElement as HTMLElement;
        const stageChildren = Array.from(stage.children);
        const midIndex = stageChildren.indexOf(mid);

        if (back && back.parentElement === stage) setImportantZ(back, Z_BACK);
        setImportantZ(mid, Z_MID);
        if (front && front.parentElement === stage) setImportantZ(front, Z_HOUSE_FRONT);

        const characters = Array.from(
          stage.querySelectorAll<HTMLElement>("[data-ambient-mini-character]"),
        );

        for (const character of characters) {
          const directIndex = stageChildren.indexOf(character);
          if (directIndex < 0) continue;

          const topLeftX = numberFromPx(character.style.left);
          const topLeftY = numberFromPx(character.style.top);
          const anchorX = topLeftX + MINI_CENTER_X;
          const anchorY = topLeftY + MINI_CENTER_Y;

          // 0.01px Y precision. 4096 leaves enough room for the full 1920px X
          // coordinate as a secondary tie-break while staying inside 32-bit z-index.
          const yRank = Math.max(0, Math.round(anchorY * 100));
          const xRank = Math.max(0, Math.min(1920, Math.round(anchorX)));
          const localDepth = yRank * 4096 + xRank * 2;
          const behindMid = directIndex < midIndex;
          const zIndex = (behindMid ? Z_BEHIND_BASE : Z_FRONT_BASE) + localDepth;

          setImportantZ(character, zIndex);
          character.dataset.ambientDepthY = anchorY.toFixed(2);
          character.dataset.ambientDepthPlane = behindMid ? "behind" : "front";
        }

        // The editor SVG must remain inspectable above HouseFront after the
        // expanded depth ranges above are applied.
        for (const child of stageChildren) {
          if (child.tagName.toLowerCase() === "svg") {
            setImportantZ(child as HTMLElement, Z_EDITOR_OVERLAY);
          }
        }
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
