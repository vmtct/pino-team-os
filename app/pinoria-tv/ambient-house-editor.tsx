"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AMBIENT_HOUSE_AREAS,
  AMBIENT_HOUSE_AREA_IDS,
  AMBIENT_HOUSE_AREA_LABELS,
  AMBIENT_HOUSE_CANVAS,
  AMBIENT_HOUSE_DEPTH_RULES,
  AMBIENT_HOUSE_INNER_BOUNDARIES,
  AMBIENT_HOUSE_OUTER_BOUNDARY,
  AMBIENT_MINI_CHARACTER,
  ambientMiniCharacterBottomRightFromAnchor,
  ambientMiniCharacterTopLeftFromAnchor,
  isPointInsidePolygon,
  type AmbientHouseAreaId,
  type AmbientHouseDepthRules,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";
import {
  initialAmbientDepthState,
  isStraightSegmentAllowed,
  randomPointInPolygon,
  resolveAmbientDepthState,
  type AmbientDepthState,
} from "./ambient-house-motion";
import { PrototypeCharacter } from "./prototype-assets";

type InnerZoneId = "inner-1" | "inner-2";
type BaseZone = "outer" | InnerZoneId;
type AreaZone = `area:${AmbientHouseAreaId}`;
type Zone = BaseZone | AreaZone;
type EditMode = "move" | "depth" | Zone;
type RoamArea = "all" | AmbientHouseAreaId;
type DepthHandle = "upper" | "ground-min" | "ground-max";

type Draft = {
  canvas: { width: number; height: number };
  miniCharacter: {
    width: number;
    height: number;
    anchor: "center";
    centerOffset: { x: number; y: number };
  };
  outerBoundary: AmbientHousePoint[];
  innerDepthZones: { id: InnerZoneId; points: AmbientHousePoint[] }[];
  areas: { id: AmbientHouseAreaId; points: AmbientHousePoint[] }[];
  depth: AmbientHouseDepthRules;
};

type DragTarget = { zone: Zone; index: number } | null;
type SimAgent = {
  id: number;
  position: AmbientHousePoint;
  from: AmbientHousePoint;
  target: AmbientHousePoint;
  phase: "pause" | "move";
  pauseUntil: number;
  moveStartedAt: number;
  durationMs: number;
  depth: AmbientDepthState;
};

const STORAGE_KEY = "pinoria:ambient-house:navmesh:1920-v5-motion-depthlock";
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
    miniCharacter: {
      width: AMBIENT_MINI_CHARACTER.width,
      height: AMBIENT_MINI_CHARACTER.height,
      anchor: "center",
      centerOffset: { ...AMBIENT_MINI_CHARACTER.centerOffset },
    },
    outerBoundary: clonePoints(AMBIENT_HOUSE_OUTER_BOUNDARY),
    innerDepthZones: [
      { id: "inner-1", points: clonePoints(AMBIENT_HOUSE_INNER_BOUNDARIES[0]) },
      { id: "inner-2", points: clonePoints(AMBIENT_HOUSE_INNER_BOUNDARIES[1]) },
    ],
    areas: AMBIENT_HOUSE_AREA_IDS.map((id) => ({ id, points: clonePoints(AMBIENT_HOUSE_AREAS[id]) })),
    depth: { ...AMBIENT_HOUSE_DEPTH_RULES },
  };
}

function roundPoint(point: AmbientHousePoint, snap: number) {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  const apply = (value: number) => snap > 0 ? Math.round(value / snap) * snap : Math.round(value * 10) / 10;
  return { x: clamp(apply(point.x), AMBIENT_HOUSE_CANVAS.width), y: clamp(apply(point.y), AMBIENT_HOUSE_CANVAS.height) };
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

function zoneColor(zone: Zone) {
  if (zone === "outer") return "#2df78c";
  if (zone === "inner-1" || zone === "inner-2") return "#ff6464";
  return AREA_COLORS[areaIdFromZone(zone)];
}

function zoneLabel(zone: Zone) {
  if (zone === "outer") return "outer";
  if (zone === "inner-1" || zone === "inner-2") return `${zone} depth-lock`;
  return `area:${AMBIENT_HOUSE_AREA_LABELS[areaIdFromZone(zone)]}`;
}

function clampY(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(AMBIENT_HOUSE_CANVAS.height, Math.max(0, Math.round(value * 10) / 10));
}

function globalWalkable(point: AmbientHousePoint, draft: Draft) {
  return isPointInsidePolygon(point, draft.outerBoundary);
}

function walkable(point: AmbientHousePoint, draft: Draft, roamArea: RoamArea = "all") {
  if (!globalWalkable(point, draft)) return false;
  if (roamArea === "all") return true;
  const area = draft.areas.find((item) => item.id === roamArea);
  return Boolean(area && area.points.length >= 3 && isPointInsidePolygon(point, area.points));
}

function areaPolygon(draft: Draft, roamArea: RoamArea) {
  if (roamArea === "all") return draft.outerBoundary;
  return draft.areas.find((item) => item.id === roamArea)?.points ?? [];
}

function randomAllowedPoint(draft: Draft, roamArea: RoamArea) {
  const polygon = areaPolygon(draft, roamArea);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const point = randomPointInPolygon(polygon);
    if (point && walkable(point, draft, roamArea)) return point;
  }
  return null;
}

function chooseStraightTarget(from: AmbientHousePoint, draft: Draft, roamArea: RoamArea) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const target = randomAllowedPoint(draft, roamArea);
    if (!target) continue;
    const distance = Math.hypot(target.x - from.x, target.y - from.y);
    if (distance < 45) continue;
    if (isStraightSegmentAllowed(from, target, (point) => walkable(point, draft, roamArea))) return target;
  }
  return null;
}

function MiniCharacterView({ anchor, inFrontOfMid, name = "Bơ", opacity = 1 }: { anchor: AmbientHousePoint; inFrontOfMid: boolean; name?: string; opacity?: number }) {
  const topLeft = ambientMiniCharacterTopLeftFromAnchor(anchor);
  return (
    <div
      data-ambient-mini-character
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: AMBIENT_MINI_CHARACTER.width,
        height: AMBIENT_MINI_CHARACTER.height,
        zIndex: inFrontOfMid ? 30 : 15,
        opacity,
        pointerEvents: "none",
        ["--ambient-mini-name" as string]: JSON.stringify(name),
      }}
    >
      <PrototypeCharacter size={164} hiddenSlots={["body", "back"]} wingMotion="off" />
    </div>
  );
}

export function AmbientHouseEditor() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<DragTarget>(null);
  const depthDragRef = useRef<DepthHandle | null>(null);
  const draggingMiniRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<EditMode>("move");
  const [snap, setSnap] = useState(1);
  const [draft, setDraft] = useState<Draft>(canonicalDraft);
  const [mini, setMini] = useState<AmbientHousePoint>({ x: 382, y: 907.5 });
  const [manualDepth, setManualDepth] = useState<AmbientDepthState>(() => initialAmbientDepthState({ x: 382, y: 907.5 }, AMBIENT_HOUSE_DEPTH_RULES));
  const [selected, setSelected] = useState<DragTarget>(null);
  const [roamArea, setRoamArea] = useState<RoamArea>("all");
  const [demo, setDemo] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [simAgents, setSimAgents] = useState<SimAgent[]>([]);
  const [status, setStatus] = useState("Straight-line motion active. Inner boundaries now lock MID depth instead of blocking movement.");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Draft;
      const hasAreas = Array.isArray(parsed.areas) && AMBIENT_HOUSE_AREA_IDS.every((id) => parsed.areas.some((area) => area.id === id));
      const hasInner = Array.isArray(parsed.innerDepthZones) && parsed.innerDepthZones.length === 2;
      if (parsed.canvas?.width === 1920 && parsed.canvas?.height === 1080 && parsed.miniCharacter?.anchor === "center" && hasAreas && hasInner && parsed.depth) {
        setDraft(parsed);
        setStatus("Loaded center-anchor mesh + areas + depth-lock zones from localStorage.");
      }
    } catch {
      // Keep canonical draft.
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      setScale(Math.min(rect.width / AMBIENT_HOUSE_CANVAS.width, rect.height / AMBIENT_HOUSE_CANVAS.height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    setManualDepth((current) => current.lockedInnerBoundary === null
      ? initialAmbientDepthState(mini, draft.depth)
      : current);
  }, [draft.depth, mini]);

  const innerPolygons = useMemo(() => draft.innerDepthZones.map((zone) => zone.points), [draft.innerDepthZones]);

  useEffect(() => {
    if (!simulate) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      setSimAgents([]);
      return;
    }

    const polygon = areaPolygon(draft, roamArea);
    if (polygon.length < 3) {
      setSimulate(false);
      setStatus(`${roamArea === "all" ? "Global" : AMBIENT_HOUSE_AREA_LABELS[roamArea]} area needs 3+ points before simulation.`);
      return;
    }

    const now = performance.now();
    const agents: SimAgent[] = [];
    for (let id = 0; id < 10; id += 1) {
      const position = randomAllowedPoint(draft, roamArea);
      if (!position) continue;
      agents.push({
        id,
        position,
        from: position,
        target: position,
        phase: "pause",
        pauseUntil: now + Math.random() * 1400,
        moveStartedAt: now,
        durationMs: 0,
        depth: initialAmbientDepthState(position, draft.depth),
      });
    }
    setSimAgents(agents);

    const tick = (time: number) => {
      setSimAgents((current) => current.map((agent) => {
        if (agent.phase === "pause") {
          if (time < agent.pauseUntil) return agent;
          const target = chooseStraightTarget(agent.position, draft, roamArea);
          if (!target) return { ...agent, pauseUntil: time + 700 };
          const distance = Math.hypot(target.x - agent.position.x, target.y - agent.position.y);
          const speedPxPerSecond = 42 + Math.random() * 34;
          return {
            ...agent,
            from: agent.position,
            target,
            phase: "move",
            moveStartedAt: time,
            durationMs: (distance / speedPxPerSecond) * 1000,
          };
        }

        const progress = Math.min(1, (time - agent.moveStartedAt) / Math.max(1, agent.durationMs));
        const position = {
          x: agent.from.x + (agent.target.x - agent.from.x) * progress,
          y: agent.from.y + (agent.target.y - agent.from.y) * progress,
        };
        const depth = resolveAmbientDepthState(agent.depth, position, draft.depth, innerPolygons);

        if (progress >= 1) {
          return {
            ...agent,
            position: agent.target,
            from: agent.target,
            phase: "pause",
            pauseUntil: time + 650 + Math.random() * 1800,
            depth,
          };
        }
        return { ...agent, position, depth };
      }));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [simulate, roamArea, draft, innerPolygons]);

  const activePoints = useMemo(() => {
    if (mode === "move" || mode === "depth") return [];
    if (mode === "outer") return draft.outerBoundary;
    if (mode === "inner-1") return draft.innerDepthZones[0].points;
    if (mode === "inner-2") return draft.innerDepthZones[1].points;
    return draft.areas.find((area) => area.id === areaIdFromZone(mode))?.points ?? [];
  }, [draft, mode]);

  const topLeft = ambientMiniCharacterTopLeftFromAnchor(mini);
  const bottomRight = ambientMiniCharacterBottomRightFromAnchor(mini);
  const anchorGlobalWalkable = globalWalkable(mini, draft);
  const anchorRoamWalkable = walkable(mini, draft, roamArea);

  function clientToCanonical(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return null;
    return roundPoint({ x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }, snap);
  }

  function pointsForZone(current: Draft, zone: Zone) {
    if (zone === "outer") return current.outerBoundary;
    if (zone === "inner-1") return current.innerDepthZones[0].points;
    if (zone === "inner-2") return current.innerDepthZones[1].points;
    return current.areas.find((area) => area.id === areaIdFromZone(zone))?.points ?? [];
  }

  function updateZone(zone: Zone, updater: (points: AmbientHousePoint[]) => AmbientHousePoint[]) {
    setDraft((current) => {
      const next: Draft = {
        ...current,
        outerBoundary: clonePoints(current.outerBoundary),
        innerDepthZones: current.innerDepthZones.map((item) => ({ ...item, points: clonePoints(item.points) })),
        areas: current.areas.map((item) => ({ ...item, points: clonePoints(item.points) })),
        depth: { ...current.depth },
      };
      if (zone === "outer") next.outerBoundary = updater(next.outerBoundary);
      else if (zone === "inner-1") next.innerDepthZones[0].points = updater(next.innerDepthZones[0].points);
      else if (zone === "inner-2") next.innerDepthZones[1].points = updater(next.innerDepthZones[1].points);
      else {
        const areaId = areaIdFromZone(zone);
        next.areas = next.areas.map((area) => area.id === areaId ? { ...area, points: updater(area.points) } : area);
      }
      console.log("NAVMESH_CHANGE", { zone, points: pointsForZone(next, zone), anchor: "center" });
      return next;
    });
  }

  function updateDepthHandle(handle: DepthHandle, rawY: number) {
    const y = clampY(rawY);
    setDraft((current) => {
      const depth = { ...current.depth };
      if (handle === "upper") depth.upperFrontY = y;
      if (handle === "ground-min") depth.groundFrontMinYExclusive = Math.min(y, depth.groundFrontMaxYExclusive - 1);
      if (handle === "ground-max") depth.groundFrontMaxYExclusive = Math.max(y, depth.groundFrontMinYExclusive + 1);
      return { ...current, depth };
    });
  }

  function updateDepthNumber(key: "upperFrontY" | "upperFrontTolerancePx" | "groundFrontMinYExclusive" | "groundFrontMaxYExclusive", value: number) {
    setDraft((current) => {
      const depth = { ...current.depth };
      if (key === "upperFrontTolerancePx") depth.upperFrontTolerancePx = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
      else if (key === "upperFrontY") depth.upperFrontY = clampY(value);
      else if (key === "groundFrontMinYExclusive") depth.groundFrontMinYExclusive = Math.min(clampY(value), depth.groundFrontMaxYExclusive - 1);
      else depth.groundFrontMaxYExclusive = Math.max(clampY(value), depth.groundFrontMinYExclusive + 1);
      return { ...current, depth };
    });
  }

  function moveManual(point: AmbientHousePoint) {
    if (!walkable(point, draft, roamArea)) return;
    setMini(point);
    setManualDepth((current) => resolveAmbientDepthState(current, point, draft.depth, innerPolygons));
  }

  function onStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;
    if (mode === "move" && !simulate) {
      draggingMiniRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      moveManual(point);
      return;
    }
    if (mode === "depth") return;
    const zone = mode === "move" ? null : mode;
    if (!zone || dragTargetRef.current) return;
    updateZone(zone, (points) => [...points, point]);
    setSelected({ zone, index: activePoints.length });
  }

  function onStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;
    if (depthDragRef.current) {
      updateDepthHandle(depthDragRef.current, point.y);
      return;
    }
    if (mode === "move" && draggingMiniRef.current && !simulate) {
      moveManual(point);
      return;
    }
    const target = dragTargetRef.current;
    if (!target) return;
    updateZone(target.zone, (points) => points.map((item, index) => index === target.index ? point : item));
  }

  function onStagePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    draggingMiniRef.current = false;
    dragTargetRef.current = null;
    depthDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function beginVertexDrag(event: React.PointerEvent<SVGCircleElement>, zone: Zone, index: number) {
    event.stopPropagation();
    dragTargetRef.current = { zone, index };
    setSelected({ zone, index });
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function beginDepthDrag(event: React.PointerEvent<SVGElement>, handle: DepthHandle) {
    event.stopPropagation();
    depthDragRef.current = handle;
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
    const start = { x: 382, y: 907.5 };
    setMini(start);
    setManualDepth(initialAmbientDepthState(start, next.depth));
    setRoamArea("all");
    setSimulate(false);
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus("Reset canonical mesh. Inner zones remain passable depth-lock zones.");
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setStatus("Copied mesh + inner depth-lock zones + learner areas + MID thresholds.");
  }

  function selectEditMode(nextMode: EditMode) {
    setMode(nextMode);
    setSelected(null);
    setSimulate(false);
    if (nextMode === "depth") setStatus("EDIT DEPTH: thresholds apply normally except while a character is inside an INNER depth-lock zone.");
    else if (nextMode !== "move" && isAreaZone(nextMode)) {
      const areaId = areaIdFromZone(nextMode);
      setRoamArea(areaId);
      setStatus(`Editing ${AMBIENT_HOUSE_AREA_LABELS[areaId]} designated wander area.`);
    }
  }

  function toggleSimulation() {
    if (!simulate) {
      const polygon = areaPolygon(draft, roamArea);
      if (polygon.length < 3) {
        setStatus("Define the designated area with 3+ points before simulation.");
        return;
      }
      setMode("move");
      setSelected(null);
      setSimulate(true);
      setStatus(`Simulating 10 mini-chars in ${roamArea === "all" ? "GLOBAL MESH" : AMBIENT_HOUSE_AREA_LABELS[roamArea]}: straight segment → random stop → new straight segment.`);
    } else {
      setSimulate(false);
      setStatus("Movement simulation stopped.");
    }
  }

  const baseButtons: { id: EditMode; label: string }[] = [
    { id: "move", label: "MOVE TEST" },
    { id: "depth", label: "EDIT DEPTH" },
    { id: "outer", label: "EDIT OUTER" },
    { id: "inner-1", label: "INNER DEPTH 1" },
    { id: "inner-2", label: "INNER DEPTH 2" },
  ];

  const areaButtons = AMBIENT_HOUSE_AREA_IDS.map((id) => ({ id: `area:${id}` as AreaZone, areaId: id, label: AMBIENT_HOUSE_AREA_LABELS[id] }));

  const renderVertices = (zone: Zone, points: readonly AmbientHousePoint[]) => points.map((point, index) => (
    <g key={`${zone}-${index}`}>
      <circle
        cx={point.x}
        cy={point.y}
        r={selected?.zone === zone && selected.index === index ? 10 : 7}
        fill="#fff"
        stroke={zoneColor(zone)}
        strokeWidth="4"
        style={{ pointerEvents: mode === "move" || mode === "depth" ? "none" : "auto", cursor: "grab" }}
        onPointerDown={(event) => beginVertexDrag(event, zone, index)}
      />
      {selected?.zone === zone && selected.index === index ? (
        <text x={point.x + 12} y={point.y - 12} fill="#fff" fontSize="18" stroke="#000" strokeWidth="3" paintOrder="stroke">{index} · {point.x},{point.y}</text>
      ) : null}
    </g>
  ));

  const upperBandTop = Math.max(0, draft.depth.upperFrontY - draft.depth.upperFrontTolerancePx);
  const upperBandHeight = Math.max(1, draft.depth.upperFrontTolerancePx * 2);
  const groundBandHeight = Math.max(0, draft.depth.groundFrontMaxYExclusive - draft.depth.groundFrontMinYExclusive);
  const frontCount = simAgents.filter((agent) => agent.depth.inFrontOfMid).length;
  const lockedCount = simAgents.filter((agent) => agent.depth.lockedInnerBoundary !== null).length;

  return (
    <div ref={viewportRef} style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#101711", color: "white", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920 * scale, height: 1080 * scale, transform: "translate(-50%, -50%)" }}>
        <div
          ref={stageRef}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={() => { draggingMiniRef.current = false; dragTargetRef.current = null; depthDragRef.current = null; }}
          style={{ position: "absolute", inset: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0", overflow: "hidden", touchAction: "none", userSelect: "none", isolation: "isolate" }}
        >
          <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 10, pointerEvents: "none" }} />

          {!simulate ? <MiniCharacterView anchor={mini} inFrontOfMid={manualDepth.inFrontOfMid} /> : null}
          {simulate ? simAgents.filter((agent) => !agent.depth.inFrontOfMid).map((agent) => <MiniCharacterView key={`behind-${agent.id}`} anchor={agent.position} inFrontOfMid={false} name="" />) : null}

          <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 20, pointerEvents: "none" }} />

          {simulate ? simAgents.filter((agent) => agent.depth.inFrontOfMid).map((agent) => <MiniCharacterView key={`front-${agent.id}`} anchor={agent.position} inFrontOfMid name="" />) : null}

          <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 50, pointerEvents: "none" }} />

          {!demo ? (
            <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ position: "absolute", inset: 0, zIndex: 60, overflow: "visible", pointerEvents: "none" }}>
              <polygon points={pointList(draft.outerBoundary)} fill="#42e78620" stroke="#4cff9d" strokeWidth="4" />

              {draft.innerDepthZones.map((zone) => zone.points.length >= 2 ? (
                <polygon key={zone.id} points={pointList(zone.points)} fill="#ff4f4f25" stroke="#ff6969" strokeWidth="4" strokeDasharray="10 7" />
              ) : null)}

              {draft.areas.map((area) => {
                const areaZone = `area:${area.id}` as AreaZone;
                const active = mode === areaZone || roamArea === area.id;
                return area.points.length >= 2 ? (
                  <polygon key={area.id} points={pointList(area.points)} fill={`${AREA_COLORS[area.id]}${active ? "35" : "18"}`} stroke={AREA_COLORS[area.id]} strokeWidth={active ? 5 : 3} strokeDasharray={active ? undefined : "12 9"} opacity={active ? 1 : .78} />
                ) : null;
              })}

              <rect x="0" y={upperBandTop} width="1920" height={upperBandHeight} fill="#63b8ff" opacity={mode === "depth" ? .18 : .05} />
              <rect x="0" y={draft.depth.groundFrontMinYExclusive} width="1920" height={groundBandHeight} fill="#ffc95b" opacity={mode === "depth" ? .16 : .05} />
              <line x1="0" y1={draft.depth.upperFrontY} x2="1920" y2={draft.depth.upperFrontY} stroke="#63b8ff" strokeWidth={mode === "depth" ? 5 : 2} strokeDasharray="14 9" opacity={mode === "depth" ? 1 : .45} />
              <line x1="0" y1={draft.depth.groundFrontMinYExclusive} x2="1920" y2={draft.depth.groundFrontMinYExclusive} stroke="#ffd05d" strokeWidth={mode === "depth" ? 5 : 2} strokeDasharray="14 9" opacity={mode === "depth" ? 1 : .45} />
              <line x1="0" y1={draft.depth.groundFrontMaxYExclusive} x2="1920" y2={draft.depth.groundFrontMaxYExclusive} stroke="#ff8b4a" strokeWidth={mode === "depth" ? 5 : 2} strokeDasharray="14 9" opacity={mode === "depth" ? 1 : .45} />

              {mode === "depth" ? (
                <>
                  <circle cx="1840" cy={draft.depth.upperFrontY} r="13" fill="#63b8ff" stroke="#07131d" strokeWidth="4" style={{ pointerEvents: "auto", cursor: "ns-resize" }} onPointerDown={(event) => beginDepthDrag(event, "upper")} />
                  <circle cx="1780" cy={draft.depth.groundFrontMinYExclusive} r="13" fill="#ffd05d" stroke="#191307" strokeWidth="4" style={{ pointerEvents: "auto", cursor: "ns-resize" }} onPointerDown={(event) => beginDepthDrag(event, "ground-min")} />
                  <circle cx="1720" cy={draft.depth.groundFrontMaxYExclusive} r="13" fill="#ff8b4a" stroke="#1c0c05" strokeWidth="4" style={{ pointerEvents: "auto", cursor: "ns-resize" }} onPointerDown={(event) => beginDepthDrag(event, "ground-max")} />
                </>
              ) : null}

              {!simulate ? (
                <>
                  <rect x={topLeft.x} y={topLeft.y} width={AMBIENT_MINI_CHARACTER.width} height={AMBIENT_MINI_CHARACTER.height} fill="none" stroke="#49dcff" strokeWidth="3" strokeDasharray="10 7" />
                  <circle cx={mini.x} cy={mini.y} r="9" fill="#ffe266" stroke="#111" strokeWidth="3" />
                  <text x={mini.x + 13} y={mini.y - 13} fill="#ffe266" fontSize="16" stroke="#000" strokeWidth="3" paintOrder="stroke">CENTER {Math.round(mini.x)},{Math.round(mini.y)}</text>
                  <circle cx={bottomRight.x} cy={bottomRight.y} r="6" fill="#ff55d6" stroke="#111" strokeWidth="2" />
                </>
              ) : simAgents.map((agent) => (
                <g key={`path-${agent.id}`}>
                  {agent.phase === "move" ? <line x1={agent.position.x} y1={agent.position.y} x2={agent.target.x} y2={agent.target.y} stroke={agent.depth.lockedInnerBoundary !== null ? "#ff8b8b" : "#ffffff"} strokeWidth="2" strokeDasharray="7 8" opacity=".28" /> : null}
                  <circle cx={agent.position.x} cy={agent.position.y} r="5" fill={agent.depth.lockedInnerBoundary !== null ? "#ff6464" : agent.depth.inFrontOfMid ? "#ffe266" : "#71c9ff"} />
                </g>
              ))}

              {renderVertices("outer", draft.outerBoundary)}
              {renderVertices("inner-1", draft.innerDepthZones[0].points)}
              {renderVertices("inner-2", draft.innerDepthZones[1].points)}
              {draft.areas.map((area) => renderVertices(`area:${area.id}` as AreaZone, area.points))}
            </svg>
          ) : null}
        </div>
      </div>

      {!demo ? (
        <aside style={{ position: "absolute", left: 18, top: 18, zIndex: 100, width: 420, maxHeight: "calc(100vh - 36px)", overflowY: "auto", padding: 14, borderRadius: 16, background: "#0d1510e8", border: "1px solid #ffffff22", backdropFilter: "blur(10px)" }}>
          <strong style={{ display: "block", fontSize: 12, letterSpacing: ".1em", color: "#f1d17b" }}>AMBIENT MOTION + DEPTH EDITOR</strong>
          <div style={{ marginTop: 4, fontSize: 12, opacity: .75 }}>1920×1080 · CENTER anchor · straight-line segments only</div>
          <div style={{ marginTop: 7, padding: 8, borderRadius: 10, background: "#ffffff0b", fontSize: 11, lineHeight: 1.45 }}>
            INNER zones no longer block movement. Entering one freezes the current MID front/behind state until the character exits it.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
            {baseButtons.map((button) => (
              <button key={button.id} onClick={() => selectEditMode(button.id)} style={{ padding: "8px 6px", borderRadius: 9, border: "1px solid #ffffff24", background: mode === button.id ? "#f0d076" : "#ffffff10", color: mode === button.id ? "#1d251e" : "#fff", cursor: "pointer", fontWeight: 700 }}>{button.label}</button>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", opacity: .66 }}>SET DESIGNATED AREA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
            {areaButtons.map((button) => (
              <button key={button.id} onClick={() => selectEditMode(button.id)} style={{ padding: "8px 6px", borderRadius: 9, border: `1px solid ${AREA_COLORS[button.areaId]}88`, background: mode === button.id ? AREA_COLORS[button.areaId] : "#ffffff0b", color: mode === button.id ? "#101510" : "#fff", fontWeight: 700 }}>{button.label}</button>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", opacity: .66 }}>MOVEMENT AREA</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
            <button onClick={() => { setRoamArea("all"); setMode("move"); setSelected(null); setSimulate(false); }} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ffffff20", background: roamArea === "all" ? "#fff" : "#ffffff0d", color: roamArea === "all" ? "#111" : "#fff" }}>ALL</button>
            {AMBIENT_HOUSE_AREA_IDS.map((id) => (
              <button key={id} onClick={() => { setRoamArea(id); setMode("move"); setSelected(null); setSimulate(false); }} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${AREA_COLORS[id]}88`, background: roamArea === id ? AREA_COLORS[id] : "#ffffff0d", color: roamArea === id ? "#111" : "#fff" }}>{AMBIENT_HOUSE_AREA_LABELS[id]}</button>
            ))}
          </div>

          <button onClick={toggleSimulation} style={{ width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 10, border: simulate ? "1px solid #ff8d8d" : "1px solid #7de5aa", background: simulate ? "#5b2424" : "#174b31", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            {simulate ? "STOP SIMULATION" : "SIMULATE MOVEMENT ×10"}
          </button>

          {simulate ? <div style={{ marginTop: 7, fontSize: 11, color: "#bdebd0" }}>10 clones · {frontCount} trước MID · {simAgents.length - frontCount} sau MID · {lockedCount} đang depth-lock</div> : null}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12 }}>
            <span>SNAP</span>
            {[0, 1, 5, 10].map((value) => <button key={value} onClick={() => setSnap(value)} style={{ borderRadius: 8, border: "1px solid #ffffff20", padding: "5px 7px", background: snap === value ? "#fff" : "#ffffff0d", color: snap === value ? "#111" : "#fff" }}>{value === 0 ? "OFF" : `${value}px`}</button>)}
          </div>

          <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid #ffd05d44", background: "#ffffff08" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", opacity: .66 }}>MID DEPTH THRESHOLDS</div>
            {([
              ["Upper center Y", "upperFrontY", draft.depth.upperFrontY],
              ["Upper tolerance ±", "upperFrontTolerancePx", draft.depth.upperFrontTolerancePx],
              ["Ground start Y", "groundFrontMinYExclusive", draft.depth.groundFrontMinYExclusive],
              ["Ground end Y", "groundFrontMaxYExclusive", draft.depth.groundFrontMaxYExclusive],
            ] as const).map(([label, key, value]) => (
              <label key={key} style={{ display: "grid", gridTemplateColumns: "1fr 92px", alignItems: "center", gap: 8, marginTop: 7, fontSize: 11 }}>
                <span>{label}</span>
                <input type="number" value={value} step="0.1" onChange={(event) => updateDepthNumber(key, Number(event.target.value))} style={{ width: 92, padding: "5px 6px", borderRadius: 7, border: "1px solid #ffffff22", background: "#0c120f", color: "#fff" }} />
              </label>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55 }}>
            {!simulate ? <div>Manual CENTER {Math.round(mini.x)},{Math.round(mini.y)} · {manualDepth.inFrontOfMid ? "CHAR trước MID" : "CHAR sau MID"} {manualDepth.lockedInnerBoundary !== null ? `· LOCK inner-${manualDepth.lockedInnerBoundary + 1}` : ""}</div> : null}
            <div>Roam: <strong>{roamArea === "all" ? "ALL GLOBAL MESH" : AMBIENT_HOUSE_AREA_LABELS[roamArea]}</strong> · {anchorRoamWalkable ? "✓ manual allowed" : "× manual outside"}</div>
            <div>Global anchor: {anchorGlobalWalkable ? "✓" : "×"} · TL {Math.round(topLeft.x)},{Math.round(topLeft.y)} · BR {Math.round(bottomRight.x)},{Math.round(bottomRight.y)}</div>
            <div>Outer {draft.outerBoundary.length} pts · Inner depth {draft.innerDepthZones[0].points.length}/{draft.innerDepthZones[1].points.length}</div>
            {draft.areas.map((area) => <div key={area.id} style={{ color: AREA_COLORS[area.id] }}>{AMBIENT_HOUSE_AREA_LABELS[area.id]} · {area.points.length} pts {area.points.length >= 3 ? "✓" : "(need 3+)"}</div>)}
            {selected ? <div>Selected {zoneLabel(selected.zone)}[{selected.index}]</div> : null}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <button onClick={deleteSelected} disabled={!selected} style={{ padding: "7px 9px" }}>Delete point</button>
            <button onClick={copyJson} style={{ padding: "7px 9px" }}>Copy JSON</button>
            <button onClick={resetDraft} style={{ padding: "7px 9px" }}>Reset</button>
            <button onClick={() => { setDemo(true); setMode("move"); setSelected(null); }} style={{ padding: "7px 12px", background: "#f0d076", color: "#162018", border: 0, borderRadius: 8, fontWeight: 800 }}>DEMO</button>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: "#cdd7ce", opacity: .82 }}>{status}</div>
        </aside>
      ) : (
        <button onClick={() => setDemo(false)} style={{ position: "fixed", right: 18, top: 18, zIndex: 120, padding: "8px 11px", borderRadius: 999, border: "1px solid #ffffff2d", background: "#101711aa", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(8px)" }}>EXIT DEMO</button>
      )}
    </div>
  );
}
