"use client";

import { useEffect, useState } from "react";
import { InventoryScene } from "./inventory-scene";
import { ShopScene } from "./shop-scene";
import { PINORIA_SHOP_RELAY_URL, PINORIA_SHOP_SURFACE_ID, type ShopSessionSnapshot } from "./shop-types";

const TV_RELAY_URL = "/api/pinoria-prototype/tv-relay";

type TvSurfaceSnapshot = {
  mode?: string;
  activeEvent?: {
    subjectId?: string | null;
  } | null;
};

export function ShopTvOverlay() {
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);
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
        const tvData = await tvResponse.json() as { surface?: TvSurfaceSnapshot };
        let nextSession = shopData.session ?? null;
        const activeSubjectId = tvData.surface?.activeEvent?.subjectId ?? null;
        const subjectMismatch = !!nextSession?.open
          && !!activeSubjectId
          && activeSubjectId !== nextSession.subject.id;

        // A transient learner event owns the shared TV. If it belongs to a
        // different learner, invalidate the old interactive Shop/Inventory
        // session so it cannot reappear after Arrival/Departure completes.
        if (subjectMismatch) {
          const closeResponse = await fetch(PINORIA_SHOP_RELAY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ surfaceId: PINORIA_SHOP_SURFACE_ID, op: "close" }),
            cache: "no-store",
          });
          if (closeResponse.ok) {
            const closeData = await closeResponse.json() as { session?: ShopSessionSnapshot };
            nextSession = closeData.session ?? nextSession;
          }
        }

        if (!stopped) {
          setSession(nextSession);
          setVisible(!!nextSession?.open
            && !subjectMismatch
            && (tvData.surface?.mode ?? "ambient") === "ambient");
        }
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
      {session?.view === "inventory"
        ? <InventoryScene surfaceId={PINORIA_SHOP_SURFACE_ID} />
        : <ShopScene surfaceId={PINORIA_SHOP_SURFACE_ID} />}
    </div>
  );
}
