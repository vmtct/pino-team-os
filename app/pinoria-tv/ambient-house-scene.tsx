"use client";

import { useMemo, useRef, useState } from "react";
import {
  AMBIENT_HOUSE_CANVAS,
  AMBIENT_HOUSE_INNER_BOUNDARIES,
  AMBIENT_HOUSE_OUTER_BOUNDARY,
  AMBIENT_MINI_CHARACTER,
  isAmbientMiniCharacterAnchorWalkable,
  isAmbientMiniCharacterInFrontOfMid,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";
import { PrototypeCharacter } from "./prototype-assets";

const START: AmbientHousePoint = { x: 300, y: 850 };
const ASSET_VERSION = "ambient-house-v1-20260821b";

const AMBIENT_HOUSE_ASSETS = {
  back: `https://assets.pinohouse.art/draft/1.png?v=${ASSET_VERSION}`,
  mid: `https://assets.pinohouse.art/draft/3.png?v=${ASSET_VERSION}`,
  front: `https://assets.pinohouse.art/draft/2.png?v=${ASSET_VERSION}`,
} as const;

type LayerName = keyof typeof AMBIENT_HOUSE_ASSETS;
type LayerState = "loading" | "loaded" | "error";

function points(points: readonly AmbientHousePoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function HouseLayer({
  src,
  zIndex,
  label,
  onLoad,
  onError,
}: {
  src: string;
  zIndex: number;
  label: string;
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <img
      src={src}
      alt=""
      aria-label={label}
      draggable={false}
      decoding="async"
      loading="eager"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      onError={onError}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "fill",
        zIndex,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

export function AmbientHouseScene({ debug = true }: { debug?: boolean }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [anchor, setAnchor] = useState<AmbientHousePoint>(START);
  const [navVisible, setNavVisible] = useState(debug);
  const [layerState, setLayerState] = useState<Record<LayerName, LayerState>>({
    back: "loading",
    mid: "loading",
    front: "loading",
  });
  const charInFrontOfMid = isAmbientMiniCharacterInFrontOfMid(anchor.y);
  const walkable = isAmbientMiniCharacterAnchorWalkable(anchor);

  function markLayer(name: LayerName, state: LayerState) {
    setLayerState((current) => (current[name] === state ? current : { ...current, [name]: state }));
  }

  const charStyle = useMemo(() => ({
    position: "absolute" as const,
    left: `${(anchor.x / AMBIENT_HOUSE_CANVAS.width) * 100}%`,
    top: `${(anchor.y / AMBIENT_HOUSE_CANVAS.height) * 100}%`,
    width: `${(AMBIENT_MINI_CHARACTER.width / AMBIENT_HOUSE_CANVAS.width) * 100}%`,
    height: `${(AMBIENT_MINI_CHARACTER.height / AMBIENT_HOUSE_CANVAS.height) * 100}%`,
    zIndex: 30,
    filter: "drop-shadow(0 8px 8px rgba(0,0,0,.32))",
    cursor: "grab",
    touchAction: "none",
  }), [anchor]);

  function canonicalPoint(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * AMBIENT_HOUSE_CANVAS.width,
      y: ((clientY - rect.top) / rect.height) * AMBIENT_HOUSE_CANVAS.height,
    } satisfies AmbientHousePoint;
  }

  function tryMove(clientX: number, clientY: number) {
    const target = canonicalPoint(clientX, clientY);
    if (!target) return;
    const next = {
      x: Math.round((target.x - AMBIENT_MINI_CHARACTER.width / 2) * 10) / 10,
      y: Math.round((target.y - AMBIENT_MINI_CHARACTER.height / 2) * 10) / 10,
    };
    if (isAmbientMiniCharacterAnchorWalkable(next)) setAnchor(next);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    tryMove(event.clientX, event.clientY);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    tryMove(event.clientX, event.clientY);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", overflow: "hidden", background: "#101711" }}>
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { draggingRef.current = false; }}
        style={{
          position: "relative",
          width: "100vw",
          maxWidth: "calc(100vh * 1.8333333)",
          aspectRatio: "1980 / 1080",
          overflow: "hidden",
          userSelect: "none",
          touchAction: "none",
          background: "#3d4939",
        }}
      >
        <HouseLayer
          src={AMBIENT_HOUSE_ASSETS.back}
          zIndex={10}
          label="HOUSE BACK"
          onLoad={() => markLayer("back", "loaded")}
          onError={() => markLayer("back", "error")}
        />

        <HouseLayer
          src={AMBIENT_HOUSE_ASSETS.mid}
          zIndex={charInFrontOfMid ? 20 : 40}
          label="HOUSE MID"
          onLoad={() => markLayer("mid", "loaded")}
          onError={() => markLayer("mid", "error")}
        />

        <div style={charStyle} data-ambient-mini-character>
          <PrototypeCharacter size="100%" wingMotion="idle" />
        </div>

        <HouseLayer
          src={AMBIENT_HOUSE_ASSETS.front}
          zIndex={50}
          label="HOUSE FRONT"
          onLoad={() => markLayer("front", "loaded")}
          onError={() => markLayer("front", "error")}
        />

        {navVisible ? (
          <svg viewBox="0 0 1980 1080" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }}>
            <polygon points={points(AMBIENT_HOUSE_OUTER_BOUNDARY)} fill="#5ae38d22" stroke="#72f0a0" strokeWidth="5" />
            {AMBIENT_HOUSE_INNER_BOUNDARIES.map((blocked, index) => (
              <polygon key={index} points={points(blocked)} fill="#ff5c5c33" stroke="#ff7878" strokeWidth="5" />
            ))}
            <line x1="0" y1="836.3" x2="1980" y2="836.3" stroke="#f7ca66" strokeWidth="3" strokeDasharray="14 10" opacity=".75" />
            <line x1="0" y1="441.9" x2="1980" y2="441.9" stroke="#77bfff" strokeWidth="3" strokeDasharray="14 10" opacity=".75" />
          </svg>
        ) : null}

        <div style={{ position: "absolute", left: 20, top: 20, zIndex: 80, padding: "12px 14px", borderRadius: 14, background: "#101711dd", color: "#f7f0df", fontFamily: "system-ui, sans-serif", fontSize: 13, lineHeight: 1.45, border: "1px solid #ffffff20", pointerEvents: "auto", maxWidth: 330 }}>
          <strong style={{ display: "block", letterSpacing: ".08em", fontSize: 11, color: "#e9c66d" }}>AMBIENT NAVMESH DEBUG · REAL HOUSE</strong>
          <span>x {anchor.x.toFixed(1)} · y {anchor.y.toFixed(1)}</span><br />
          <span>{walkable ? "✓ Đi được" : "× Ngoài vùng"} · {charInFrontOfMid ? "CHAR trước MID" : "MID trước CHAR"}</span><br />
          <span style={{ display: "block", marginTop: 5, fontSize: 11, opacity: .78 }}>
            BACK {layerState.back} · MID {layerState.mid} · FRONT {layerState.front}
          </span>
          {(layerState.back === "error" || layerState.mid === "error" || layerState.front === "error") ? (
            <span style={{ display: "block", marginTop: 5, color: "#ffb0a8", fontSize: 11 }}>
              Asset lỗi tải: mở URL R2 trực tiếp để kiểm tra object/public access. Cache-bust đã bật.
            </span>
          ) : null}
          <button onClick={(event) => { event.stopPropagation(); setNavVisible((value) => !value); }} style={{ marginTop: 8, border: "1px solid #ffffff2a", borderRadius: 999, background: "#ffffff10", color: "inherit", padding: "5px 9px", cursor: "pointer" }}>
            {navVisible ? "Ẩn navmesh" : "Hiện navmesh"}
          </button>
        </div>

        <div style={{ position: "absolute", right: 20, bottom: 18, zIndex: 80, borderRadius: 999, background: "#101711cc", color: "#e7ddca", padding: "8px 12px", fontFamily: "system-ui, sans-serif", fontSize: 12, pointerEvents: "none" }}>
          Kéo mini-char để test boundary · FRONT luôn ở trên
        </div>
      </div>
    </div>
  );
}
