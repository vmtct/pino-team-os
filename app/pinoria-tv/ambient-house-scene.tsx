"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
const ASSET_VERSION = "ambient-house-v1-20260821f";

const AMBIENT_HOUSE_ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
} as const;

type LayerName = keyof typeof AMBIENT_HOUSE_ASSETS;
type LayerState = "loading" | "loaded" | "rejected-opaque" | "error";
type LayerInfo = {
  state: LayerState;
  width?: number;
  height?: number;
  transparentPct?: number;
  semiTransparentPct?: number;
  opaquePct?: number;
};

function points(items: readonly AmbientHousePoint[]) {
  return items.map((point) => `${point.x},${point.y}`).join(" ");
}

function CanvasHouseLayer({
  layer,
  src,
  zIndex,
  onReport,
}: {
  layer: LayerName;
  src: string;
  zIndex: number;
  onReport: (layer: LayerName, info: LayerInfo) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    onReport(layer, { state: "loading" });

    const image = new Image();
    image.decoding = "async";

    image.onload = () => {
      if (cancelled) return;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        onReport(layer, { state: "error" });
        return;
      }

      canvas.width = AMBIENT_HOUSE_CANVAS.width;
      canvas.height = AMBIENT_HOUSE_CANVAS.height;
      context.clearRect(0, 0, AMBIENT_HOUSE_CANVAS.width, AMBIENT_HOUSE_CANVAS.height);
      context.drawImage(
        image,
        0,
        0,
        AMBIENT_HOUSE_CANVAS.width,
        AMBIENT_HOUSE_CANVAS.height,
      );

      let transparent = 0;
      let semiTransparent = 0;
      let opaque = 0;
      let samples = 0;

      try {
        const pixels = context.getImageData(
          0,
          0,
          AMBIENT_HOUSE_CANVAS.width,
          AMBIENT_HOUSE_CANVAS.height,
        ).data;

        // Sampling every 16th pixel is enough to validate alpha while keeping
        // this prototype debug route cheap on lower-powered TV hardware.
        for (let index = 3; index < pixels.length; index += 4 * 16) {
          const alpha = pixels[index];
          samples += 1;
          if (alpha === 0) transparent += 1;
          else if (alpha === 255) opaque += 1;
          else semiTransparent += 1;
        }
      } catch {
        onReport(layer, {
          state: "loaded",
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        return;
      }

      const transparentPct = samples ? (transparent / samples) * 100 : 0;
      const semiTransparentPct = samples ? (semiTransparent / samples) * 100 : 0;
      const opaquePct = samples ? (opaque / samples) * 100 : 0;

      // BACK is intentionally opaque. MID and FRONT must contain substantial
      // transparent area. Reject a flattened/opaque upstream response instead
      // of allowing it to hide the layers underneath.
      if (layer !== "back" && transparentPct < 1) {
        context.clearRect(0, 0, AMBIENT_HOUSE_CANVAS.width, AMBIENT_HOUSE_CANVAS.height);
        onReport(layer, {
          state: "rejected-opaque",
          width: image.naturalWidth,
          height: image.naturalHeight,
          transparentPct,
          semiTransparentPct,
          opaquePct,
        });
        return;
      }

      onReport(layer, {
        state: "loaded",
        width: image.naturalWidth,
        height: image.naturalHeight,
        transparentPct,
        semiTransparentPct,
        opaquePct,
      });
    };

    image.onerror = () => {
      if (!cancelled) onReport(layer, { state: "error" });
    };

    image.src = src;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [layer, onReport, src]);

  return (
    <canvas
      ref={canvasRef}
      width={AMBIENT_HOUSE_CANVAS.width}
      height={AMBIENT_HOUSE_CANVAS.height}
      aria-label={`HOUSE ${layer.toUpperCase()}`}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: AMBIENT_HOUSE_CANVAS.width,
        height: AMBIENT_HOUSE_CANVAS.height,
        zIndex,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

export function AmbientHouseScene({ debug = true }: { debug?: boolean }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [stageScale, setStageScale] = useState(1);
  const [anchor, setAnchor] = useState<AmbientHousePoint>(START);
  const [navVisible, setNavVisible] = useState(debug);
  const [layerInfo, setLayerInfo] = useState<Record<LayerName, LayerInfo>>({
    back: { state: "loading" },
    mid: { state: "loading" },
    front: { state: "loading" },
  });

  const charInFrontOfMid = isAmbientMiniCharacterInFrontOfMid(anchor.y);
  const walkable = isAmbientMiniCharacterAnchorWalkable(anchor);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function updateScale() {
      const rect = viewport.getBoundingClientRect();
      const next = Math.min(
        rect.width / AMBIENT_HOUSE_CANVAS.width,
        rect.height / AMBIENT_HOUSE_CANVAS.height,
      );
      setStageScale(Number.isFinite(next) && next > 0 ? next : 1);
    }

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const reportLayer = useMemo(
    () => (name: LayerName, info: LayerInfo) => {
      setLayerInfo((current) => {
        const existing = current[name];
        if (
          existing.state === info.state &&
          existing.width === info.width &&
          existing.height === info.height &&
          existing.transparentPct === info.transparentPct &&
          existing.semiTransparentPct === info.semiTransparentPct &&
          existing.opaquePct === info.opaquePct
        ) {
          return current;
        }
        return { ...current, [name]: info };
      });
    },
    [],
  );

  const charStyle = useMemo(() => ({
    position: "absolute" as const,
    left: anchor.x,
    top: anchor.y,
    width: AMBIENT_MINI_CHARACTER.width,
    height: AMBIENT_MINI_CHARACTER.height,
    zIndex: 30,
    filter: "drop-shadow(0 8px 8px rgba(0,0,0,.32))",
    cursor: debug ? "grab" : "default",
    touchAction: "none",
  }), [anchor, debug]);

  function canonicalPoint(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || stageScale <= 0) return null;

    return {
      x: (clientX - rect.left) / stageScale,
      y: (clientY - rect.top) / stageScale,
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
    if (!debug) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    tryMove(event.clientX, event.clientY);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!debug || !draggingRef.current) return;
    tryMove(event.clientX, event.clientY);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!debug) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const scaledWidth = AMBIENT_HOUSE_CANVAS.width * stageScale;
  const scaledHeight = AMBIENT_HOUSE_CANVAS.height * stageScale;
  const sourceMismatch = (Object.entries(layerInfo) as [LayerName, LayerInfo][]).some(([, info]) =>
    info.state === "loaded" &&
    (info.width !== AMBIENT_HOUSE_CANVAS.width || info.height !== AMBIENT_HOUSE_CANVAS.height),
  );
  const alphaRejected = layerInfo.mid.state === "rejected-opaque" || layerInfo.front.state === "rejected-opaque";

  return (
    <div
      ref={viewportRef}
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "#101711",
      }}
    >
      <div
        style={{
          position: "relative",
          width: scaledWidth,
          height: scaledHeight,
          overflow: "hidden",
        }}
      >
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { draggingRef.current = false; }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: AMBIENT_HOUSE_CANVAS.width,
            height: AMBIENT_HOUSE_CANVAS.height,
            transform: `scale(${stageScale})`,
            transformOrigin: "0 0",
            overflow: "hidden",
            userSelect: "none",
            touchAction: "none",
            background: "#3d4939",
            isolation: "isolate",
          }}
        >
          <CanvasHouseLayer
            layer="back"
            src={AMBIENT_HOUSE_ASSETS.back}
            zIndex={10}
            onReport={reportLayer}
          />

          <CanvasHouseLayer
            layer="mid"
            src={AMBIENT_HOUSE_ASSETS.mid}
            zIndex={charInFrontOfMid ? 20 : 40}
            onReport={reportLayer}
          />

          <div style={charStyle} data-ambient-mini-character>
            <PrototypeCharacter size="100%" wingMotion="idle" />
          </div>

          <CanvasHouseLayer
            layer="front"
            src={AMBIENT_HOUSE_ASSETS.front}
            zIndex={50}
            onReport={reportLayer}
          />

          {navVisible ? (
            <svg
              width={AMBIENT_HOUSE_CANVAS.width}
              height={AMBIENT_HOUSE_CANVAS.height}
              viewBox="0 0 1980 1080"
              style={{ position: "absolute", left: 0, top: 0, width: 1980, height: 1080, zIndex: 60, pointerEvents: "none" }}
            >
              <polygon points={points(AMBIENT_HOUSE_OUTER_BOUNDARY)} fill="#5ae38d22" stroke="#72f0a0" strokeWidth="5" />
              {AMBIENT_HOUSE_INNER_BOUNDARIES.map((blocked, index) => (
                <polygon key={index} points={points(blocked)} fill="#ff5c5c33" stroke="#ff7878" strokeWidth="5" />
              ))}
              <line x1="0" y1="836.3" x2="1980" y2="836.3" stroke="#f7ca66" strokeWidth="3" strokeDasharray="14 10" opacity=".75" />
              <line x1="0" y1="441.9" x2="1980" y2="441.9" stroke="#77bfff" strokeWidth="3" strokeDasharray="14 10" opacity=".75" />
            </svg>
          ) : null}

          {debug ? (
            <>
              <div style={{ position: "absolute", left: 20, top: 20, zIndex: 80, padding: "12px 14px", borderRadius: 14, background: "#101711dd", color: "#f7f0df", fontFamily: "system-ui, sans-serif", fontSize: 13, lineHeight: 1.45, border: "1px solid #ffffff20", pointerEvents: "auto", maxWidth: 440 }}>
                <strong style={{ display: "block", letterSpacing: ".08em", fontSize: 11, color: "#e9c66d" }}>AMBIENT NAVMESH DEBUG · CANONICAL</strong>
                <span>CANVAS 1980×1080 · uniform scale {stageScale.toFixed(4)}</span><br />
                <span>x {anchor.x.toFixed(1)} · y {anchor.y.toFixed(1)}</span><br />
                <span>{walkable ? "✓ Đi được" : "× Ngoài vùng"} · {charInFrontOfMid ? "CHAR trước MID" : "MID trước CHAR"}</span>
                {(Object.entries(layerInfo) as [LayerName, LayerInfo][]).map(([name, info]) => (
                  <span key={name} style={{ display: "block", marginTop: 3, fontSize: 11, opacity: .82 }}>
                    {name.toUpperCase()} {info.state}
                    {info.width && info.height ? ` · ${info.width}×${info.height}` : ""}
                    {typeof info.transparentPct === "number" ? ` · α0 ${info.transparentPct.toFixed(1)}%` : ""}
                    {typeof info.semiTransparentPct === "number" ? ` · αsemi ${info.semiTransparentPct.toFixed(1)}%` : ""}
                  </span>
                ))}
                <span style={{ display: "block", marginTop: 5, fontSize: 10, opacity: .72 }}>
                  SAME-ORIGIN PNG PROXY → CANVAS COMPOSITING · source alpha preserved 1:1
                </span>
                {sourceMismatch ? (
                  <span style={{ display: "block", marginTop: 5, color: "#ffb0a8", fontSize: 11 }}>
                    Source dimension mismatch: asset phải là đúng 1980×1080.
                  </span>
                ) : null}
                {alphaRejected ? (
                  <span style={{ display: "block", marginTop: 5, color: "#ffb0a8", fontSize: 11 }}>
                    MID/FRONT bị reject vì upstream trả về gần như opaque; layer này không được phép che BACK.
                  </span>
                ) : null}
                <button onClick={(event) => { event.stopPropagation(); setNavVisible((value) => !value); }} style={{ marginTop: 8, border: "1px solid #ffffff2a", borderRadius: 999, background: "#ffffff10", color: "inherit", padding: "5px 9px", cursor: "pointer" }}>
                  {navVisible ? "Ẩn navmesh" : "Hiện navmesh"}
                </button>
              </div>

              <div style={{ position: "absolute", right: 20, bottom: 18, zIndex: 80, borderRadius: 999, background: "#101711cc", color: "#e7ddca", padding: "8px 12px", fontFamily: "system-ui, sans-serif", fontSize: 12, pointerEvents: "none" }}>
                1980×1080 canonical · PNG alpha composited on canvas · FRONT luôn ở trên
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
