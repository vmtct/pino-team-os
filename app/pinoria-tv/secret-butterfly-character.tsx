"use client";

import type { CSSProperties } from "react";
import { PrototypeCharacterPrestigeEffects } from "./prototype-assets";

export const SECRET_BUTTERFLY_URL = "https://assets.pinohouse.art/pinoria/Secret_Butterfly.webm";

export function SecretButterflyCharacter({ style, markIds }: { style?: CSSProperties; markIds?: readonly string[] }) {
  return (
    <div data-pinoria-secret-butterfly-shell style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{`
        @keyframes pinoriaPrestigeAuraBreath { 0%,100%{transform:scale(.985)} 36%{transform:scale(1.012)} 58%{transform:scale(1.02)} 82%{transform:scale(.994)} }
        @keyframes pinoriaPrestigeAuraRadiance { 0%,14%,100%{opacity:.72;filter:brightness(.98) drop-shadow(0 0 10px rgba(182,111,255,.14))} 27%{opacity:.91;filter:brightness(1.075) drop-shadow(0 0 25px rgba(182,111,255,.29))} 43%{opacity:.77;filter:brightness(1.005) drop-shadow(0 0 13px rgba(182,111,255,.18))} 66%{opacity:.97;filter:brightness(1.11) drop-shadow(0 0 32px rgba(182,111,255,.35))} 83%{opacity:.8;filter:brightness(1.02) drop-shadow(0 0 16px rgba(182,111,255,.2))} }
        @keyframes pinoriaPrestigeGlowCycle { 0%{opacity:0;filter:brightness(.96) saturate(.98)} 6.25%,25%{opacity:.62;filter:brightness(1.08) saturate(1.06)} 31.25%,100%{opacity:0;filter:brightness(.98) saturate(1)} }
        @keyframes pinoriaSecretButterflyAmbient { 0%,100%{opacity:.54;transform:scale(.96)} 50%{opacity:.82;transform:scale(1.04)} }
      `}</style>
      <div data-pinoria-secret-butterfly-ambient style={{ position: "absolute", inset: "9% 8% 5%", zIndex: 1, borderRadius: "50%", background: "radial-gradient(circle,rgba(151,92,207,.16),rgba(103,64,151,.07) 44%,transparent 72%)", filter: "blur(13px)", animation: "pinoriaSecretButterflyAmbient 5.2s ease-in-out infinite" }} />
      <PrototypeCharacterPrestigeEffects motion="shop-preview" markIds={markIds} />
      <video data-pinoria-secret-butterfly src={SECRET_BUTTERFLY_URL} aria-hidden="true" autoPlay loop muted playsInline preload="auto" disablePictureInPicture style={{ position: "absolute", inset: 0, zIndex: 10, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", pointerEvents: "none", filter: "drop-shadow(0 19px 22px rgba(0,0,0,.2))", ...style }} />
    </div>
  );
}
