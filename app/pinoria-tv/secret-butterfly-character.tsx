"use client";

import type { CSSProperties } from "react";

export const SECRET_BUTTERFLY_URL =
  "https://assets.pinohouse.art/pinoria/Secret_Butterfly.webm";

export function SecretButterflyCharacter({ style }: { style?: CSSProperties }) {
  return (
    <video
      data-pinoria-secret-butterfly
      src={SECRET_BUTTERFLY_URL}
      aria-hidden="true"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 50%", pointerEvents: "none", filter: "drop-shadow(0 19px 22px rgba(0,0,0,.2))", ...style }}
    />
  );
}
