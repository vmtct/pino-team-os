"use client";

import { useEffect, useState } from "react";
import { ShopScene } from "./shop-scene";
import { PINORIA_SHOP_RELAY_URL, PINORIA_SHOP_SURFACE_ID, type ShopSessionSnapshot } from "./shop-types";

const TV_RELAY_URL = "/api/pinoria-prototype/tv-relay";

export function ShopTvOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [shopResponse, tvResponse] = await Promise.all([
          fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${PINORIA_SHOP_SURFACE_ID}`, { cache: "no-store" }),
          fetch(`${TV_RELAY_URL}?surfaceId=${PINORIA_SHOP_SURFACE_ID}`, { cache: "no-store" }),
        ]);
        if (!shopResponse.ok || !tvResponse.ok) return;
        const shopData = await shopResponse.json() as { session?: ShopSessionSnapshot };
        const tvData = await tvResponse.json() as { surface?: { mode?: string } };
        if (!stopped) setVisible(!!shopData.session?.open && (tvData.surface?.mode ?? "ambient") === "ambient");
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

  if (!visible) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none" }}>
      <ShopScene surfaceId={PINORIA_SHOP_SURFACE_ID} />
    </div>
  );
}
