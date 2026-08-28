"use client";

import { useRef } from "react";
import PinerPrototypeV19 from "./PinerPrototypeV19";
import { usePrototypePolish } from "./usePrototypePolish";

const TEXT_SELECTOR = "p, small, span, strong, em, button, label, li, h1, h2, h3, h4";

function hasDirectReadableText(element: HTMLElement) {
  return Array.from(element.childNodes).some((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return false;
    return /[\p{L}\p{N}]/u.test(node.textContent ?? "");
  });
}

function scaledSmallType(size: number) {
  if (size >= 13) return size;
  const scaled = Math.max(10, 7 + size / 2);
  return Math.round(scaled * 2) / 2;
}

function applyTypographyFloor(root: HTMLElement) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(TEXT_SELECTOR));

  candidates.forEach((element) => {
    if (element.closest("aside")) return;
    if (!hasDirectReadableText(element)) return;

    const computed = window.getComputedStyle(element);
    const currentSize = Number.parseFloat(computed.fontSize);
    if (!Number.isFinite(currentSize) || currentSize >= 13) return;

    const nextSize = scaledSmallType(currentSize);
    const currentApplied = Number.parseFloat(element.dataset.v20FontSize ?? "0");
    if (currentApplied === nextSize) return;

    element.style.setProperty("font-size", `${nextSize}px`, "important");
    element.dataset.v20FontFloor = "true";
    element.dataset.v20FontSize = String(nextSize);
  });
}

export default function PinerPrototypeV20() {
  const rootRef = useRef<HTMLDivElement>(null);

  usePrototypePolish(rootRef, applyTypographyFloor);

  return (
    <div ref={rootRef}>
      <PinerPrototypeV19 />
    </div>
  );
}
