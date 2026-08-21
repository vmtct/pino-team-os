"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AMBIENT_HOUSE_CANVAS,
  AMBIENT_HOUSE_INNER_BOUNDARIES,
  AMBIENT_HOUSE_OUTER_BOUNDARY,
  AMBIENT_MINI_CHARACTER,
  isPointInsidePolygon,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";
import { PrototypeCharacter } from "./prototype-assets";

type EditMode = "move" | "outer" | "inner-1" | "inner-2";
type Zone = "outer" | "inner-1" | "inner-2";
type Draft = {
  canvas: { width: number; height: number };
  miniCharacter: { width: number; height: number; anchor: "top-left" };
  outerBoundary: AmbientHousePoint[];
  obstacles: { id: "inner-1" | "inner-2"; points: AmbientHousePoint[] }[];
};
type DragTarget = { zone: Zone; index: number } | null;

const STORAGE_KEY = "pinoria:ambient-house:navmesh:1920-v1";
const ASSET_VERSION = "ambient-house-1920-20260821a";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

function clonePoints(points: readonly AmbientHousePoint[]) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function canonicalDraft(): Draft {
  return {
    canvas: { ...AMBIENT_HOUSE_CANVAS },
    miniCharacter: { ...AMBIENT_MINI_CHARACTER },
    outerBoundary: clonePoints(AMBIENT_HOUSE_OUTER_BOUNDARY),
    obstacles: [
      { id: "inner-1", points: clonePoints(AMBIENT_HOUSE_INNER_BOUNDARIES[0]) },
      { id: "inner-2", points: clonePoints(AMBIENT_HOUSE_INNER_BOUNDARIES[1]) },
    ],
  };
}

function roundPoint(point: AmbientHousePoint, snap: number) {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  const apply = (value: number) => snap > 0 ? Math.round(value / snap) * snap : Math.round(value * 10) / 10;
  return {
    x: clamp(apply(point.x), AMBIENT_HOUSE_CANVAS.width),
    y: clamp(apply(point.y), AMBIENT_HOUSE_CANVAS.height),
  };
}

function pointList(points: readonly AmbientHousePoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function walkable(point: AmbientHousePoint, draft: Draft) {
  if (!isPointInsidePolygon(point, draft.outerBoundary)) return false;
  return !draft.obstacles.some((zone) => isPointInsidePolygon(point, zone.points));
}

function miniEndpoint(anchor: AmbientHousePoint): AmbientHousePoint {
  return {
    x: anchor.x + AMBIENT_MINI_CHARACTER.width,
    y: anchor.y + AMBIENT_MINI_CHARACTER.height,
  };
}

export function AmbientHouseEditor() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<DragTarget>(null);
  const draggingMiniRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<EditMode>("move");
  const [snap, setSnap] = useState(1);
  const [draft, setDraft] = useState<Draft>(canonicalDraft);
  const [mini, setMini] = useState<AmbientHousePoint>({ x: 300, y: 850 });
  const [selected, setSelected] = useState<DragTarget>(null);
  const [status, setStatus] = useState("Draft migrated from 1980 → 1920. Drag vertices to refine.");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Draft;
      if (parsed.canvas?.width === 1920 && parsed.canvas?.height === 1080) {
        setDraft(parsed);
        setStatus("Loaded saved 1920×1080 draft from localStorage.");
      }
    } catch {
      // Ignore invalid local draft and continue from canonical bootstrap.
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      setScale(Math.min(rect.width / 1920, rect.height / 1080));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const activePoints = useMemo(() => {
    if (mode === "outer") return draft.outerBoundary;
    if (mode === "inner-1") return draft.obstacles[0].points;
    if (mode === "inner-2") return draft.obstacles[1].points;
    return [];
  }, [draft, mode]);

  const end = miniEndpoint(mini);
  const anchorWalkable = walkable(mini, draft);
  const endpointWalkable = walkable(end, draft);

  function clientToCanonical(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return null;
    return roundPoint({ x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }, snap);
  }

  function updateZone(zone: Zone, updater: (points: AmbientHousePoint[]) => AmbientHousePoint[]) {
    setDraft((current) => {
      const next: Draft = {
        ...current,
        outerBoundary: clonePoints(current.outerBoundary),
        obstacles: current.obstacles.map((item) => ({ ...item, points: clonePoints(item.points) })),
      };
      if (zone === "outer") next.outerBoundary = updater(next.outerBoundary);
      if (zone === "inner-1") next.obstacles[0].points = updater(next.obstacles[0].points);
      if (zone === "inner-2") next.obstacles[1].points = updater(next.obstacles[1].points);
      console.log("NAVMESH_CHANGE", {
        zone,
        points: zone === "outer" ? next.outerBoundary : next.obstacles[zone === "inner-1" ? 0 : 1].points,
      });
      return next;
    });
  }

  function activeZone(): Zone | null {
    if (mode === "outer") return "outer";
    if (mode === "inner-1") return "inner-1";
    if (mode === "inner-2") return "inner-2";
    return null;
  }

  function onStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;

    if (mode === "move") {
      draggingMiniRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (walkable(point, draft)) setMini(point);
      return;
    }

    const zone = activeZone();
    if (!zone || dragTargetRef.current) return;
    updateZone(zone, (points) => [...points, point]);
    setSelected({ zone, index: activePoints.length });
    setStatus(`Added ${zone} point ${point.x}, ${point.y}`);
  }

  function onStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;

    if (mode === "move" && draggingMiniRef.current) {
      if (walkable(point, draft)) setMini(point);
      return;
    }

    const target = dragTargetRef.current;
    if (!target) return;
    updateZone(target.zone, (points) => points.map((item, index) => index === target.index ? point : item));
    setSelected(target);
  }

  function onStagePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    draggingMiniRef.current = false;
    dragTargetRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function beginVertexDrag(event: React.PointerEvent<SVGCircleElement>, zone: Zone, index: number) {
    event.stopPropagation();
    dragTargetRef.current = { zone, index };
    setSelected({ zone, index });
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function deleteSelected() {
    if (!selected) return;
    updateZone(selected.zone, (points) => points.filter((_, index) => index !== selected.index));
    setSelected(null);
  }

  function resetDraft() {
    const next = canonicalDraft();
    setDraft(next);
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus("Reset to migrated 1920×1080 bootstrap geometry.");
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setStatus("Copied full 1920×1080 navmesh JSON.");
  }

  const zoneButtons: { id: EditMode; label: string }[] = [
    { id: "move", label: "MOVE TEST" },
    { id: "outer", label: "EDIT OUTER" },
    { id: "inner-1", label: "EDIT INNER 1" },
    { id: "inner-2", label: "EDIT INNER 2" },
  ];

  const renderVertices = (zone: Zone, points: readonly AmbientHousePoint[]) => points.map((point, index) => (
    <g key={`${zone}-${index}`}>
      <circle
        cx={point.x}
        cy={point.y}
        r={selected?.zone === zone && selected.index === index ? 10 : 7}
        fill="#fff"
        stroke={zone === "outer" ? "#2df78c" : "#ff6464"}
        strokeWidth="4"
        style={{ pointerEvents: mode === "move" ? "none" : "auto", cursor: "grab" }}
        onPointerDown={(event) => beginVertexDrag(event, zone, index)}
      />
      {selected?.zone === zone && selected.index === index ? (
        <text x={point.x + 12} y={point.y - 12} fill="#fff" fontSize="18" stroke="#000" strokeWidth="3" paintOrder="stroke">
          {index} · {point.x},{point.y}
        </text>
      ) : null}
    </g>
  ));

  return (
    <div ref={viewportRef} style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#101711", color: "white", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920 * scale, height: 1080 * scale, transform: "translate(-50%, -50%)" }}>
        <div
          ref={stageRef}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={() => { draggingMiniRef.current = false; dragTargetRef.current = null; }}
          style={{ position: "absolute", inset: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0", overflow: "hidden", touchAction: "none", userSelect: "none", isolation: "isolate" }}
        >
          <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 10, pointerEvents: "none" }} />
          <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 20, pointerEvents: "none" }} />

          <div
            data-ambient-mini-character
            style={{
              position: "absolute",
              left: mini.x,
              top: mini.y,
              width: 164,
              height: 115,
              zIndex: 30,
              cursor: mode === "move" ? "grab" : "default",
              ["--ambient-mini-name" as string]: '"Bơ"',
            }}
          >
            <PrototypeCharacter size={164} hiddenSlots={["body", "back"]} wingMotion="off" />
          </div>

          <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 50, pointerEvents: "none" }} />

          <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ position: "absolute", inset: 0, zIndex: 60, overflow: "visible", pointerEvents: "none" }}>
            <polygon points={pointList(draft.outerBoundary)} fill="#42e78620" stroke="#4cff9d" strokeWidth="4" />
            {draft.obstacles.map((zone) => (
              <polygon key={zone.id} points={pointList(zone.points)} fill="#ff4f4f35" stroke="#ff6969" strokeWidth="4" />
            ))}

            <rect
              x={mini.x}
              y={mini.y}
              width={AMBIENT_MINI_CHARACTER.width}
              height={AMBIENT_MINI_CHARACTER.height}
              fill="none"
              stroke="#49dcff"
              strokeWidth="3"
              strokeDasharray="10 7"
              opacity=".95"
            />
            <circle cx={mini.x} cy={mini.y} r="8" fill="#ffe266" stroke="#111" strokeWidth="3" />
            <text x={mini.x + 12} y={mini.y - 12} fill="#ffe266" fontSize="16" stroke="#000" strokeWidth="3" paintOrder="stroke">
              A {mini.x},{mini.y}
            </text>
            <circle cx={end.x} cy={end.y} r="9" fill="#ff55d6" stroke="#111" strokeWidth="3" />
            <text x={end.x + 12} y={end.y - 12} fill="#ff9bea" fontSize="16" stroke="#000" strokeWidth="3" paintOrder="stroke">
              END {end.x},{end.y}
            </text>

            {renderVertices("outer", draft.outerBoundary)}
            {renderVertices("inner-1", draft.obstacles[0].points)}
            {renderVertices("inner-2", draft.obstacles[1].points)}
          </svg>
        </div>
      </div>

      <aside style={{ position: "absolute", left: 18, top: 18, zIndex: 100, width: 350, padding: 14, borderRadius: 16, background: "#0d1510e8", border: "1px solid #ffffff22", backdropFilter: "blur(10px)" }}>
        <strong style={{ display: "block", fontSize: 12, letterSpacing: ".1em", color: "#f1d17b" }}>AMBIENT NAVMESH EDITOR</strong>
        <div style={{ marginTop: 4, fontSize: 12, opacity: .75 }}>Canonical 1920×1080 · local draft autosave</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
          {zoneButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => { setMode(button.id); setSelected(null); }}
              style={{ padding: "8px 6px", borderRadius: 9, border: "1px solid #ffffff24", background: mode === button.id ? "#f0d076" : "#ffffff10", color: mode === button.id ? "#1d251e" : "#fff", cursor: "pointer", fontWeight: 700 }}
            >
              {button.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12 }}>
          <span>SNAP</span>
          {[0, 1, 5, 10].map((value) => (
            <button
              key={value}
              onClick={() => setSnap(value)}
              style={{ borderRadius: 8, border: "1px solid #ffffff20", padding: "5px 7px", background: snap === value ? "#fff" : "#ffffff0d", color: snap === value ? "#111" : "#fff" }}
            >
              {value === 0 ? "OFF" : `${value}px`}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55 }}>
          <div><span style={{ color: "#ffe266" }}>●</span> Anchor TL x {mini.x} · y {mini.y} · {anchorWalkable ? "✓ walkable" : "× blocked"}</div>
          <div><span style={{ color: "#ff55d6" }}>●</span> Endpoint BR x {end.x} · y {end.y} · {endpointWalkable ? "✓ inside mesh" : "× outside/blocked"}</div>
          <div style={{ opacity: .7 }}>Footprint {AMBIENT_MINI_CHARACTER.width}×{AMBIENT_MINI_CHARACTER.height}</div>
          <div>Outer {draft.outerBoundary.length} pts · Inner {draft.obstacles[0].points.length}/{draft.obstacles[1].points.length}</div>
          {selected ? <div>Selected {selected.zone}[{selected.index}]</div> : null}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <button onClick={deleteSelected} disabled={!selected} style={{ padding: "7px 9px" }}>Delete point</button>
          <button onClick={copyJson} style={{ padding: "7px 9px" }}>Copy JSON</button>
          <button onClick={resetDraft} style={{ padding: "7px 9px" }}>Reset</button>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "#cdd7ce", opacity: .82 }}>{status}</div>
        <div style={{ marginTop: 8, fontSize: 10, opacity: .58 }}>
          Cyan box = mini footprint. Yellow A = top-left movement anchor. Pink END = bottom-right endpoint for boundary comparison only; movement still validates the anchor.
        </div>
      </aside>
    </div>
  );
}
