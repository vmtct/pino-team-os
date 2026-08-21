"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AMBIENT_HOUSE_AREAS,
  AMBIENT_HOUSE_AREA_IDS,
  AMBIENT_HOUSE_AREA_LABELS,
  AMBIENT_HOUSE_CANVAS,
  AMBIENT_HOUSE_INNER_BOUNDARIES,
  AMBIENT_HOUSE_OUTER_BOUNDARY,
  AMBIENT_MINI_CHARACTER,
  isPointInsidePolygon,
  type AmbientHouseAreaId,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";
import { PrototypeCharacter } from "./prototype-assets";

type BaseZone = "outer" | "inner-1" | "inner-2";
type AreaZone = `area:${AmbientHouseAreaId}`;
type Zone = BaseZone | AreaZone;
type EditMode = "move" | Zone;
type RoamArea = "all" | AmbientHouseAreaId;

type Draft = {
  canvas: { width: number; height: number };
  miniCharacter: { width: number; height: number; anchor: "top-left" };
  outerBoundary: AmbientHousePoint[];
  obstacles: { id: "inner-1" | "inner-2"; points: AmbientHousePoint[] }[];
  areas: { id: AmbientHouseAreaId; points: AmbientHousePoint[] }[];
};

type DragTarget = { zone: Zone; index: number } | null;

const STORAGE_KEY = "pinoria:ambient-house:navmesh:1920-v2-areas";
const ASSET_VERSION = "ambient-house-1920-20260821a";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

const AREA_COLORS: Record<AmbientHouseAreaId, string> = {
  reception: "#54b9ff",
  artchitect: "#ffad4d",
  "little-piner": "#ff72bd",
  pianohouse: "#a783ff",
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
    areas: AMBIENT_HOUSE_AREA_IDS.map((id) => ({ id, points: clonePoints(AMBIENT_HOUSE_AREAS[id]) })),
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

function isAreaZone(zone: Zone): zone is AreaZone {
  return zone.startsWith("area:");
}

function areaIdFromZone(zone: AreaZone): AmbientHouseAreaId {
  return zone.slice(5) as AmbientHouseAreaId;
}

function globalWalkable(point: AmbientHousePoint, draft: Draft) {
  if (!isPointInsidePolygon(point, draft.outerBoundary)) return false;
  return !draft.obstacles.some((zone) => isPointInsidePolygon(point, zone.points));
}

function walkable(point: AmbientHousePoint, draft: Draft, roamArea: RoamArea = "all") {
  if (!globalWalkable(point, draft)) return false;
  if (roamArea === "all") return true;
  const area = draft.areas.find((item) => item.id === roamArea);
  return Boolean(area && isPointInsidePolygon(point, area.points));
}

function miniEndpoint(anchor: AmbientHousePoint): AmbientHousePoint {
  return {
    x: anchor.x + AMBIENT_MINI_CHARACTER.width,
    y: anchor.y + AMBIENT_MINI_CHARACTER.height,
  };
}

function zoneColor(zone: Zone) {
  if (zone === "outer") return "#2df78c";
  if (zone === "inner-1" || zone === "inner-2") return "#ff6464";
  return AREA_COLORS[areaIdFromZone(zone)];
}

function zoneLabel(zone: Zone) {
  if (zone === "outer") return "outer";
  if (zone === "inner-1" || zone === "inner-2") return zone;
  const areaId = areaIdFromZone(zone);
  return `area:${AMBIENT_HOUSE_AREA_LABELS[areaId]}`;
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
  const [roamArea, setRoamArea] = useState<RoamArea>("all");
  const [status, setStatus] = useState("Loaded new canonical 1920×1080 mesh. Define learner home areas below.");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Draft;
      const hasAreas = Array.isArray(parsed.areas) && AMBIENT_HOUSE_AREA_IDS.every((id) => parsed.areas.some((area) => area.id === id));
      if (parsed.canvas?.width === 1920 && parsed.canvas?.height === 1080 && hasAreas) {
        setDraft(parsed);
        setStatus("Loaded saved 1920×1080 mesh + area draft from localStorage.");
      }
    } catch {
      // Ignore invalid local draft and continue from canonical config.
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
    if (mode === "move") return [];
    if (mode === "outer") return draft.outerBoundary;
    if (mode === "inner-1") return draft.obstacles[0].points;
    if (mode === "inner-2") return draft.obstacles[1].points;
    const areaId = areaIdFromZone(mode);
    return draft.areas.find((area) => area.id === areaId)?.points ?? [];
  }, [draft, mode]);

  const end = miniEndpoint(mini);
  const anchorGlobalWalkable = globalWalkable(mini, draft);
  const endpointGlobalWalkable = globalWalkable(end, draft);
  const anchorRoamWalkable = walkable(mini, draft, roamArea);

  function clientToCanonical(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return null;
    return roundPoint({ x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }, snap);
  }

  function pointsForZone(current: Draft, zone: Zone) {
    if (zone === "outer") return current.outerBoundary;
    if (zone === "inner-1") return current.obstacles[0].points;
    if (zone === "inner-2") return current.obstacles[1].points;
    const areaId = areaIdFromZone(zone);
    return current.areas.find((area) => area.id === areaId)?.points ?? [];
  }

  function updateZone(zone: Zone, updater: (points: AmbientHousePoint[]) => AmbientHousePoint[]) {
    setDraft((current) => {
      const next: Draft = {
        ...current,
        outerBoundary: clonePoints(current.outerBoundary),
        obstacles: current.obstacles.map((item) => ({ ...item, points: clonePoints(item.points) })),
        areas: current.areas.map((item) => ({ ...item, points: clonePoints(item.points) })),
      };

      if (zone === "outer") next.outerBoundary = updater(next.outerBoundary);
      else if (zone === "inner-1") next.obstacles[0].points = updater(next.obstacles[0].points);
      else if (zone === "inner-2") next.obstacles[1].points = updater(next.obstacles[1].points);
      else {
        const areaId = areaIdFromZone(zone);
        next.areas = next.areas.map((area) => area.id === areaId ? { ...area, points: updater(area.points) } : area);
      }

      console.log("NAVMESH_CHANGE", { zone, points: pointsForZone(next, zone) });
      return next;
    });
  }

  function activeZone(): Zone | null {
    return mode === "move" ? null : mode;
  }

  function onStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;

    if (mode === "move") {
      draggingMiniRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (walkable(point, draft, roamArea)) setMini(point);
      return;
    }

    const zone = activeZone();
    if (!zone || dragTargetRef.current) return;
    updateZone(zone, (points) => [...points, point]);
    setSelected({ zone, index: activePoints.length });
    setStatus(`Added ${zoneLabel(zone)} point ${point.x}, ${point.y}`);
  }

  function onStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;

    if (mode === "move" && draggingMiniRef.current) {
      if (walkable(point, draft, roamArea)) setMini(point);
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
    setRoamArea("all");
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus("Reset to the new canonical 1920×1080 mesh; learner areas cleared.");
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setStatus("Copied full mesh + Reception/Artchitect/Little Piner/Piano House area JSON.");
  }

  function selectEditMode(nextMode: EditMode) {
    setMode(nextMode);
    setSelected(null);
    if (nextMode !== "move" && isAreaZone(nextMode)) {
      const areaId = areaIdFromZone(nextMode);
      setRoamArea(areaId);
      setStatus(`Editing ${AMBIENT_HOUSE_AREA_LABELS[areaId]} home/wander area.`);
    }
  }

  const baseButtons: { id: EditMode; label: string }[] = [
    { id: "move", label: "MOVE TEST" },
    { id: "outer", label: "EDIT OUTER" },
    { id: "inner-1", label: "EDIT INNER 1" },
    { id: "inner-2", label: "EDIT INNER 2" },
  ];

  const areaButtons = AMBIENT_HOUSE_AREA_IDS.map((id) => ({
    id: `area:${id}` as AreaZone,
    areaId: id,
    label: AMBIENT_HOUSE_AREA_LABELS[id],
  }));

  const renderVertices = (zone: Zone, points: readonly AmbientHousePoint[]) => points.map((point, index) => (
    <g key={`${zone}-${index}`}>
      <circle
        cx={point.x}
        cy={point.y}
        r={selected?.zone === zone && selected.index === index ? 10 : 7}
        fill="#fff"
        stroke={zoneColor(zone)}
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

            {draft.areas.map((area) => {
              const areaZone = `area:${area.id}` as AreaZone;
              const active = mode === areaZone || roamArea === area.id;
              return area.points.length >= 2 ? (
                <polygon
                  key={area.id}
                  points={pointList(area.points)}
                  fill={`${AREA_COLORS[area.id]}${active ? "35" : "18"}`}
                  stroke={AREA_COLORS[area.id]}
                  strokeWidth={active ? 5 : 3}
                  strokeDasharray={active ? undefined : "12 9"}
                  opacity={active ? 1 : .78}
                />
              ) : null;
            })}

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
            {draft.areas.map((area) => renderVertices(`area:${area.id}` as AreaZone, area.points))}
          </svg>
        </div>
      </div>

      <aside style={{ position: "absolute", left: 18, top: 18, zIndex: 100, width: 380, maxHeight: "calc(100vh - 36px)", overflowY: "auto", padding: 14, borderRadius: 16, background: "#0d1510e8", border: "1px solid #ffffff22", backdropFilter: "blur(10px)" }}>
        <strong style={{ display: "block", fontSize: 12, letterSpacing: ".1em", color: "#f1d17b" }}>AMBIENT NAVMESH + AREA EDITOR</strong>
        <div style={{ marginTop: 4, fontSize: 12, opacity: .75 }}>Canonical 1920×1080 · local draft autosave</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
          {baseButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => selectEditMode(button.id)}
              style={{ padding: "8px 6px", borderRadius: 9, border: "1px solid #ffffff24", background: mode === button.id ? "#f0d076" : "#ffffff10", color: mode === button.id ? "#1d251e" : "#fff", cursor: "pointer", fontWeight: 700 }}
            >
              {button.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", opacity: .66 }}>SET LEARNER HOME AREA</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
          {areaButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => selectEditMode(button.id)}
              style={{ padding: "8px 6px", borderRadius: 9, border: `1px solid ${AREA_COLORS[button.areaId]}88`, background: mode === button.id ? AREA_COLORS[button.areaId] : "#ffffff0b", color: mode === button.id ? "#101510" : "#fff", cursor: "pointer", fontWeight: 700 }}
            >
              {button.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", opacity: .66 }}>MOVE TEST CONSTRAINT</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
          <button onClick={() => { setRoamArea("all"); setMode("move"); setSelected(null); }} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ffffff20", background: roamArea === "all" ? "#fff" : "#ffffff0d", color: roamArea === "all" ? "#111" : "#fff" }}>ALL</button>
          {AMBIENT_HOUSE_AREA_IDS.map((id) => (
            <button
              key={id}
              onClick={() => { setRoamArea(id); setMode("move"); setSelected(null); }}
              style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${AREA_COLORS[id]}88`, background: roamArea === id ? AREA_COLORS[id] : "#ffffff0d", color: roamArea === id ? "#111" : "#fff" }}
            >
              {AMBIENT_HOUSE_AREA_LABELS[id]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12 }}>
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
          <div><span style={{ color: "#ffe266" }}>●</span> Anchor TL x {mini.x} · y {mini.y} · {anchorGlobalWalkable ? "✓ global" : "× blocked"}</div>
          <div><span style={{ color: "#ff55d6" }}>●</span> Endpoint BR x {end.x} · y {end.y} · {endpointGlobalWalkable ? "✓ inside mesh" : "× outside/blocked"}</div>
          <div>Roam: <strong>{roamArea === "all" ? "ALL GLOBAL MESH" : AMBIENT_HOUSE_AREA_LABELS[roamArea]}</strong> · {anchorRoamWalkable ? "✓ allowed" : "× outside area"}</div>
          <div style={{ opacity: .7 }}>Footprint {AMBIENT_MINI_CHARACTER.width}×{AMBIENT_MINI_CHARACTER.height}</div>
          <div>Outer {draft.outerBoundary.length} pts · Inner {draft.obstacles[0].points.length}/{draft.obstacles[1].points.length}</div>
          {draft.areas.map((area) => <div key={area.id} style={{ color: AREA_COLORS[area.id] }}>{AMBIENT_HOUSE_AREA_LABELS[area.id]} · {area.points.length} pts {area.points.length >= 3 ? "✓" : "(need 3+)"}</div>)}
          {selected ? <div>Selected {zoneLabel(selected.zone)}[{selected.index}]</div> : null}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <button onClick={deleteSelected} disabled={!selected} style={{ padding: "7px 9px" }}>Delete point</button>
          <button onClick={copyJson} style={{ padding: "7px 9px" }}>Copy JSON</button>
          <button onClick={resetDraft} style={{ padding: "7px 9px" }}>Reset</button>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "#cdd7ce", opacity: .82 }}>{status}</div>
        <div style={{ marginTop: 8, fontSize: 10, opacity: .58 }}>
          Area mode: click to add polygon points and drag handles to refine. MOVE TEST → choose a room constraint to verify the learner can only wander inside that room. Transit from check-in can still use the global green mesh until the learner reaches the assigned home area.
        </div>
      </aside>
    </div>
  );
}
