"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import savedSnapshot from "./ambient-house-areas.saved.json";

type Point = { x: number; y: number };
type AreaId = "reception" | "artchitect" | "little-piner" | "pianohouse";
type AreaBoundary = { id: AreaId; label: string; points: Point[] };
type AreaSnapshot = {
  canvas: { width: 1920; height: 1080 };
  areas: AreaBoundary[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

const WIDTH = 1920;
const HEIGHT = 1080;
const STORAGE_KEY = "pinoria:ambient-house:area-boundaries:1920-v1";
const AREA_IDS: AreaId[] = ["reception", "artchitect", "little-piner", "pianohouse"];
const AREA_COLORS: Record<AreaId, string> = {
  reception: "#ffd65a",
  artchitect: "#7dffd7",
  "little-piner": "#ff91d2",
  pianohouse: "#8fb7ff",
};

function cloneSnapshot(snapshot: AreaSnapshot): AreaSnapshot {
  return {
    canvas: { width: 1920, height: 1080 },
    areas: snapshot.areas.map((area) => ({
      id: area.id,
      label: area.label,
      points: area.points.map((point) => ({ ...point })),
    })),
  };
}

function isSnapshot(value: unknown): value is AreaSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AreaSnapshot>;
  if (candidate.canvas?.width !== WIDTH || candidate.canvas?.height !== HEIGHT) return false;
  if (!Array.isArray(candidate.areas) || candidate.areas.length !== AREA_IDS.length) return false;
  const ids = new Set(candidate.areas.map((area) => area?.id));
  if (!AREA_IDS.every((id) => ids.has(id))) return false;
  return candidate.areas.every((area) => Array.isArray(area.points)
    && area.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
}

function codeSnapshot(): AreaSnapshot {
  return cloneSnapshot(savedSnapshot as AreaSnapshot);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPoint(point: Point): Point {
  return {
    x: clamp(Math.round(point.x), 0, WIDTH),
    y: clamp(Math.round(point.y), 0, HEIGHT),
  };
}

function centroid(points: readonly Point[]) {
  if (!points.length) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function pointsAttr(points: readonly Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function AmbientAreaBoundaryEditor() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ areaId: AreaId; pointIndex: number; pointerId: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [open, setOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<AreaId>("reception");
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<AreaSnapshot>(codeSnapshot);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [status, setStatus] = useState("Area boundaries loaded from code.");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (isSnapshot(parsed)) {
          setSnapshot(cloneSnapshot(parsed));
          setStatus("Area boundaries loaded from local draft.");
        }
      } catch {
        // Fall back to checked-in code snapshot.
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [snapshot]);

  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const selectedArea = useMemo(
    () => snapshot.areas.find((area) => area.id === selectedAreaId) ?? snapshot.areas[0],
    [snapshot.areas, selectedAreaId],
  );

  function clientToPoint(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return roundPoint({
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    });
  }

  function updateArea(areaId: AreaId, updater: (area: AreaBoundary) => AreaBoundary) {
    setSnapshot((current) => ({
      ...current,
      areas: current.areas.map((area) => area.id === areaId ? updater(area) : area),
    }));
    setSaveState("idle");
  }

  function addPoint(point: Point) {
    let nextIndex = 0;
    updateArea(selectedAreaId, (area) => {
      nextIndex = area.points.length;
      return { ...area, points: [...area.points, point] };
    });
    setSelectedPointIndex(nextIndex);
    setStatus(`${selectedArea.label}: added point ${nextIndex + 1} at ${point.x}, ${point.y}.`);
  }

  function movePoint(areaId: AreaId, pointIndex: number, point: Point) {
    updateArea(areaId, (area) => ({
      ...area,
      points: area.points.map((current, index) => index === pointIndex ? point : current),
    }));
  }

  function deleteSelectedPoint() {
    if (selectedPointIndex === null) return;
    const index = selectedPointIndex;
    updateArea(selectedAreaId, (area) => ({
      ...area,
      points: area.points.filter((_, pointIndex) => pointIndex !== index),
    }));
    setSelectedPointIndex(null);
    setStatus(`${selectedArea.label}: deleted selected point.`);
  }

  function undoPoint() {
    if (!selectedArea.points.length) return;
    updateArea(selectedAreaId, (area) => ({ ...area, points: area.points.slice(0, -1) }));
    setSelectedPointIndex(null);
    setStatus(`${selectedArea.label}: removed last point.`);
  }

  function clearSelectedArea() {
    updateArea(selectedAreaId, (area) => ({ ...area, points: [] }));
    setSelectedPointIndex(null);
    setStatus(`${selectedArea.label}: boundary cleared. Click canvas to mark again.`);
  }

  function reloadFromCode() {
    const next = codeSnapshot();
    setSnapshot(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSelectedPointIndex(null);
    setSaveState("idle");
    setStatus("Reloaded all area boundaries from checked-in code snapshot.");
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setStatus("Copied area boundary JSON.");
  }

  async function saveToCode() {
    setSaveState("saving");
    setStatus("Saving area boundaries to code…");
    try {
      const response = await fetch("/api/pinoria-prototype/ambient-area-boundaries-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const payload = await response.json() as { ok?: boolean; path?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP_${response.status}`);
      setSaveState("saved");
      setStatus("Saved area boundaries to app/pinoria-tv/ambient-house-areas.saved.json.");
    } catch (error) {
      setSaveState("error");
      setStatus(error instanceof Error ? `Area save failed: ${error.message}` : "Area save failed.");
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "s") {
        if (!open) return;
        event.preventDefault();
        void saveToCode();
        return;
      }
      if (event.altKey && event.shiftKey && key === "c") {
        if (!open) return;
        event.preventDefault();
        void copyJson();
        return;
      }
      if (event.altKey && event.shiftKey && key === "r") {
        if (!open) return;
        event.preventDefault();
        reloadFromCode();
        return;
      }
      if (event.shiftKey && event.key === "Delete") {
        if (!open) return;
        event.preventDefault();
        clearSelectedArea();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!open || selectedPointIndex === null) return;
        event.preventDefault();
        deleteSelectedPoint();
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        dragRef.current = null;
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      if (key === "a") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!open) return;
      if (key === "z") {
        event.preventDefault();
        undoPoint();
        return;
      }
      const index = Number(key) - 1;
      if (index >= 0 && index < AREA_IDS.length) {
        event.preventDefault();
        setSelectedAreaId(AREA_IDS[index]);
        setSelectedPointIndex(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, selectedAreaId, selectedArea, selectedPointIndex, snapshot]);

  function onStagePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!open || event.button !== 0) return;
    const point = clientToPoint(event.clientX, event.clientY);
    if (!point) return;
    addPoint(point);
  }

  function onStagePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = clientToPoint(event.clientX, event.clientY);
    if (!point) return;
    movePoint(drag.areaId, drag.pointIndex, point);
  }

  function endDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setStatus(`${selectedArea.label}: point moved.`);
  }

  function beginPointDrag(
    event: React.PointerEvent<SVGCircleElement>,
    areaId: AreaId,
    pointIndex: number,
  ) {
    if (!open) return;
    event.stopPropagation();
    setSelectedAreaId(areaId);
    setSelectedPointIndex(pointIndex);
    dragRef.current = { areaId, pointIndex, pointerId: event.pointerId };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          position: "fixed",
          right: 18,
          top: 124,
          zIndex: 245,
          border: open ? "1px solid #f0d076" : "1px solid #ffffff2a",
          borderRadius: 10,
          padding: "8px 11px",
          background: open ? "#f0d076" : "#101711e8",
          color: open ? "#172018" : "#fff",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        AREA BOUNDARIES {open ? "ON" : "OFF"} · A
      </button>

      {open ? (
        <>
          <div
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              width: WIDTH * scale,
              height: HEIGHT * scale,
              transform: "translate(-50%, -50%)",
              zIndex: 215,
              pointerEvents: "auto",
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              width={WIDTH}
              height={HEIGHT}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                position: "absolute",
                inset: 0,
                width: WIDTH,
                height: HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "0 0",
                overflow: "visible",
                touchAction: "none",
                cursor: "crosshair",
              }}
            >
              {snapshot.areas.map((area) => {
                const selected = area.id === selectedAreaId;
                const color = AREA_COLORS[area.id];
                const center = centroid(area.points);
                return (
                  <g key={area.id}>
                    {area.points.length >= 3 ? (
                      <polygon
                        points={pointsAttr(area.points)}
                        fill={color}
                        fillOpacity={selected ? 0.16 : 0.08}
                        stroke={color}
                        strokeWidth={selected ? 6 : 3}
                        strokeDasharray={selected ? undefined : "12 8"}
                        pointerEvents="none"
                      />
                    ) : area.points.length >= 2 ? (
                      <polyline
                        points={pointsAttr(area.points)}
                        fill="none"
                        stroke={color}
                        strokeWidth={selected ? 6 : 3}
                        strokeDasharray="12 8"
                        pointerEvents="none"
                      />
                    ) : null}
                    {area.points.length ? (
                      <text
                        x={center.x}
                        y={center.y}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="20"
                        fontWeight="800"
                        stroke="#000"
                        strokeWidth="5"
                        paintOrder="stroke"
                        pointerEvents="none"
                      >
                        {area.label}
                      </text>
                    ) : null}
                    {area.points.map((point, index) => (
                      <circle
                        key={`${area.id}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={selected && selectedPointIndex === index ? 13 : 10}
                        fill={selected && selectedPointIndex === index ? "#fff" : color}
                        stroke="#111"
                        strokeWidth="4"
                        style={{ cursor: "move" }}
                        onPointerDown={(event) => beginPointDrag(event, area.id, index)}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          <aside
            style={{
              position: "fixed",
              right: 18,
              top: 166,
              zIndex: 246,
              width: 330,
              padding: 12,
              borderRadius: 14,
              border: "1px solid #ffffff2a",
              background: "#101711ee",
              color: "#fff",
              fontFamily: "system-ui, sans-serif",
              backdropFilter: "blur(10px)",
            }}
          >
            <strong style={{ fontSize: 11, letterSpacing: ".1em", color: "#f0d076" }}>PINO AREA BOUNDARY EDITOR</strong>
            <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.5, opacity: .75 }}>
              Click empty canvas to append vertices. Drag any vertex to refine. Polygon closes automatically from the last point back to the first.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
              {snapshot.areas.map((area, index) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => { setSelectedAreaId(area.id); setSelectedPointIndex(null); }}
                  style={{
                    border: `1px solid ${AREA_COLORS[area.id]}88`,
                    borderRadius: 8,
                    padding: "7px",
                    background: selectedAreaId === area.id ? AREA_COLORS[area.id] : "#ffffff0c",
                    color: selectedAreaId === area.id ? "#111" : "#fff",
                    fontWeight: 800,
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  {index + 1} · {area.label} · {area.points.length}pt
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10, padding: 8, borderRadius: 9, background: "#ffffff08", fontSize: 10, lineHeight: 1.55 }}>
              <strong>{selectedArea.label}</strong> · {selectedArea.points.length} vertices · {selectedArea.points.length >= 3 ? "VALID POLYGON" : "NEED ≥3 POINTS"}<br />
              A toggle · 1–4 select area · Z undo · Del selected point · Shift+Del clear area<br />
              Ctrl+Shift+S save code · Alt+Shift+C copy JSON · Alt+Shift+R reload code · Esc close
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              <button type="button" onClick={undoPoint} disabled={!selectedArea.points.length} style={{ padding: "7px 8px" }}>Undo · Z</button>
              <button type="button" onClick={deleteSelectedPoint} disabled={selectedPointIndex === null} style={{ padding: "7px 8px" }}>Delete point · Del</button>
              <button type="button" onClick={clearSelectedArea} style={{ padding: "7px 8px" }}>Clear area · Shift+Del</button>
              <button type="button" onClick={() => void copyJson()} style={{ padding: "7px 8px" }}>Copy JSON</button>
              <button type="button" onClick={reloadFromCode} style={{ padding: "7px 8px" }}>Reload code</button>
            </div>

            <button
              type="button"
              onClick={() => void saveToCode()}
              disabled={saveState === "saving"}
              style={{
                width: "100%",
                marginTop: 8,
                borderRadius: 9,
                border: saveState === "saved" ? "1px solid #8df5b8" : saveState === "error" ? "1px solid #ff9d9d" : "1px solid #ffffff22",
                padding: "9px",
                background: saveState === "saved" ? "#174b31" : saveState === "error" ? "#5b2424" : "#ffffff0d",
                color: "#fff",
                fontWeight: 800,
                cursor: saveState === "saving" ? "wait" : "pointer",
              }}
            >
              {saveState === "saving" ? "SAVING…" : "SAVE AREAS TO CODE · Ctrl+Shift+S"}
            </button>

            <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.45, color: saveState === "error" ? "#ffaaaa" : "#d7e0d8" }}>
              {status}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
