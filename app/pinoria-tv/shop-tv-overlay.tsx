"use client";

import { useEffect, useState } from "react";
import { InventoryScene } from "./inventory-scene";
import { ShopScene } from "./shop-scene";
import {
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_SURFACE_ID,
  PINORIA_SURFACE_SESSION_URL,
  type PinoriaSurfaceSessionSnapshot,
  type ShopCatalogItem,
} from "./shop-types";

export function ShopTvOverlay() {
  const [surface, setSurface] = useState<PinoriaSurfaceSessionSnapshot | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(
          `${PINORIA_SURFACE_SESSION_URL}?surfaceId=${encodeURIComponent(PINORIA_SHOP_SURFACE_ID)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json() as { surface?: PinoriaSurfaceSessionSnapshot };
        if (!stopped && data.surface) setSurface(data.surface);
      } catch {
        // Leave the last projection state intact during a brief local relay pause.
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 420);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let stopped = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "force-cache" })
      .then((response) => response.json())
      .then((data: { items?: ShopCatalogItem[] }) => {
        if (stopped || !Array.isArray(data.items)) return;
        data.items.slice(0, 6).forEach((item) => {
          [item.imageUrl, item.layerUrl].filter(Boolean).forEach((src) => {
            const image = new Image();
            image.decoding = "async";
            image.src = src as string;
          });
        });
      })
      .catch(() => undefined);
    return () => { stopped = true; };
  }, []);

  const interactiveVisible = !!surface?.online
    && !surface.interactiveSuspended
    && (surface.effectiveMode === "shop" || surface.effectiveMode === "inventory")
    && !!surface.interactive;

  if (!interactiveVisible) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none" }}>
      {surface?.effectiveMode === "inventory"
        ? <InventoryScene surfaceId={PINORIA_SHOP_SURFACE_ID} />
        : <ShopScene surfaceId={PINORIA_SHOP_SURFACE_ID} />}
    </div>
  );
}
