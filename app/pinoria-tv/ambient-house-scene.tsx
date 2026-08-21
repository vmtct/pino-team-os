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

function points(points: readonly AmbientHousePoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function BackDebugLayer() {
  return (
    <svg viewBox="0 0 1980 1080" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="ambientSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c3150" />
          <stop offset="1" stopColor="#75504d" />
        </linearGradient>
      </defs>
      <rect width="1980" height="1080" fill="url(#ambientSky)" />
      <rect x="65" y="205" width="840" height="360" rx="22" fill="#8a745f" opacity=".72" />
      <rect x="930" y="205" width="930" height="360" rx="22" fill="#7c6654" opacity=".65" />
      <rect x="45" y="565" width="430" height="385" rx="18" fill="#66704f" opacity=".74" />
      <rect x="475" y="565" width="455" height="385" rx="18" fill="#586773" opacity=".72" />
      <rect x="930" y="565" width="300" height="385" rx="18" fill="#796957" opacity=".72" />
      <rect x="1230" y="565" width="660" height="385" rx="18" fill="#8a5d48" opacity=".74" />
      <g fill="#f4e6c8" opacity=".78" fontFamily="system-ui, sans-serif" fontSize="28" fontWeight="700">
        <text x="105" y="250">PIANO ROOM</text>
        <text x="1140" y="250">PRIVATE MASS</text>
        <text x="95" y="620">RECEPTION</text>
        <text x="540" y="620">ARTCHITECT</text>
        <text x="970" y="620">STAIR</text>
        <text x="1310" y="620">LITTLE PINER</text>
      </g>
    </svg>
  );
}

function MidDebugLayer() {
  return (
    <svg viewBox="0 0 1980 1080" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <g fill="#3b2d24" stroke="#e4c48f" strokeWidth="4" opacity=".88">
        <rect x="165" y="690" width="250" height="95" rx="18" />
        <rect x="535" y="765" width="310" height="92" rx="16" />
        <ellipse cx="1550" cy="815" rx="155" ry="62" />
        <path d="M943 827 L1110 827 L1058 585 L995 585 Z" />
        <path d="M265 300 C315 235 480 235 530 330 L490 438 L285 438 Z" />
      </g>
      <g fill="#f3d992" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="700" opacity=".9">
        <text x="212" y="745">QUẦY</text>
        <text x="610" y="818">BÀN HỌA</text>
        <text x="1480" y="820">BÀN LP</text>
        <text x="982" y="710">CẦU THANG</text>
        <text x="338" y="365">PIANO</text>
      </g>
    </svg>
  );
}

function FrontDebugLayer() {
  return (
    <svg viewBox="0 0 1980 1080" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <path d="M0 1000 C280 915 430 970 605 1020 C865 1090 1110 1030 1320 1000 C1580 960 1770 930 1980 1005 L1980 1080 L0 1080 Z" fill="#172418" opacity=".92" />
      <path d="M1610 0 C1710 72 1795 130 1980 178 L1980 0 Z" fill="#182718" opacity=".92" />
      <path d="M1885 0 C1835 225 1845 470 1905 700" fill="none" stroke="#281e18" strokeWidth="56" strokeLinecap="round" opacity=".92" />
      <path d="M0 1005 H1980" stroke="#d8a85e" strokeWidth="5" opacity=".42" />
    </svg>
  );
}

export function AmbientHouseScene({ debug = true }: { debug?: boolean }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [anchor, setAnchor] = useState<AmbientHousePoint>(START);
  const [navVisible, setNavVisible] = useState(debug);
  const charInFrontOfMid = isAmbientMiniCharacterInFrontOfMid(anchor.y);
  const walkable = isAmbientMiniCharacterAnchorWalkable(anchor);

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
        <BackDebugLayer />

        {charInFrontOfMid ? <MidDebugLayer /> : null}

        <div style={charStyle} data-ambient-mini-character>
          <PrototypeCharacter size="100%" wingMotion="idle" />
        </div>

        {!charInFrontOfMid ? <MidDebugLayer /> : null}

        <FrontDebugLayer />

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

        <div style={{ position: "absolute", left: 20, top: 20, zIndex: 80, padding: "12px 14px", borderRadius: 14, background: "#101711dd", color: "#f7f0df", fontFamily: "system-ui, sans-serif", fontSize: 13, lineHeight: 1.45, border: "1px solid #ffffff20", pointerEvents: "auto" }}>
          <strong style={{ display: "block", letterSpacing: ".08em", fontSize: 11, color: "#e9c66d" }}>AMBIENT NAVMESH DEBUG</strong>
          <span>x {anchor.x.toFixed(1)} · y {anchor.y.toFixed(1)}</span><br />
          <span>{walkable ? "✓ Đi được" : "× Ngoài vùng"} · {charInFrontOfMid ? "CHAR trước MID" : "MID trước CHAR"}</span><br />
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
