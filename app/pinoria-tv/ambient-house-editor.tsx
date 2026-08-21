"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AMBIENT_HOUSE_CANVAS,
  AMBIENT_MINI_CHARACTER,
  ambientMiniCharacterTopLeftFromAnchor,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";
import {
  canonicalizeAmbientMotionGraph,
  intersectRawConnectorWithLanes,
  laneLength,
  normalizeAmbientHorizontalLane,
  pointOnLane,
  type AmbientCanonicalConnector,
  type AmbientHorizontalLane,
  type AmbientLaneDepth,
  type AmbientMotionGraphRaw,
  type AmbientRawConnector,
} from "./ambient-house-motion-graph";
import { PrototypeCharacter } from "./prototype-assets";

type EditMode = "test" | "lane" | "connector";
type Selection = { kind: "lane"; id: string } | { kind: "connector"; id: string } | null;
type DragHandle =
  | { kind: "lane-start" | "lane-end"; id: string }
  | { kind: "connector-from" | "connector-to"; id: string }
  | null;
type LaneMove = {
  id: string;
  pointerStart: AmbientHousePoint;
  laneStart: AmbientHorizontalLane;
} | null;
type TestCharPlacement =
  | { kind: "lane"; laneId: string; x: number }
  | { kind: "connector"; connectorId: string; sourceRawId: string; t: number };

type SimAgent = {
  id: number;
  name: string;
  position: AmbientHousePoint;
  currentLaneId: string;
  depth: AmbientLaneDepth;
  phase: "pause" | "move";
  moveKind: "lane" | "connector";
  from: AmbientHousePoint;
  target: AmbientHousePoint;
  pauseUntil: number;
  moveStartedAt: number;
  durationMs: number;
  pendingConnectorId?: string;
  targetLaneId?: string;
};

const LEARNER_NAME = "Bơ";
const STORAGE_KEY = "pinoria:ambient-house:motion-graph:1920-v1";
const ASSET_VERSION = "ambient-house-1920-20260821d-lane-graph";
const LANE_CLONE_GAP_PX = 20;
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

const LANE_COLORS: Record<AmbientLaneDepth, string> = {
  front: "#ffd65a",
  behind: "#68c7ff",
};

function canonicalDraft(): AmbientMotionGraphRaw {
  return {
    canvas: { ...AMBIENT_HOUSE_CANVAS },
    miniCharacter: {
      width: AMBIENT_MINI_CHARACTER.width,
      height: AMBIENT_MINI_CHARACTER.height,
      anchor: "center",
      centerOffset: { ...AMBIENT_MINI_CHARACTER.centerOffset },
    },
    horizontalLanes: [],
    rawConnectors: [],
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPoint(point: AmbientHousePoint, snap: number) {
  const apply = (value: number) => snap > 0 ? Math.round(value / snap) * snap : Math.round(value * 10) / 10;
  return {
    x: clamp(apply(point.x), 0, AMBIENT_HOUSE_CANVAS.width),
    y: clamp(apply(point.y), 0, AMBIENT_HOUSE_CANVAS.height),
  };
}

function idNumber(id: string) {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function nextId(prefix: string, ids: readonly string[]) {
  const next = ids.reduce((max, id) => Math.max(max, idNumber(id)), 0) + 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
}

function projectPointToSegment(point: AmbientHousePoint, from: AmbientHousePoint, to: AmbientHousePoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= 0.0001
    ? 0
    : clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1);
  const projected = { x: from.x + dx * t, y: from.y + dy * t };
  return { point: projected, t, distance: Math.hypot(point.x - projected.x, point.y - projected.y) };
}

function pointOnConnector(connector: AmbientCanonicalConnector, t: number): AmbientHousePoint {
  const safeT = clamp(t, 0, 1);
  return {
    x: connector.from.x + (connector.to.x - connector.from.x) * safeT,
    y: connector.from.y + (connector.to.y - connector.from.y) * safeT,
  };
}

function MiniCharacterView({
  anchor,
  name = LEARNER_NAME,
  showBodySection = true,
}: {
  anchor: AmbientHousePoint;
  name?: string;
  showBodySection?: boolean;
}) {
  const topLeft = ambientMiniCharacterTopLeftFromAnchor(anchor);
  return (
    <div
      data-ambient-mini-character
      data-ambient-mini-body={showBodySection ? "on" : "off"}
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: AMBIENT_MINI_CHARACTER.width,
        height: AMBIENT_MINI_CHARACTER.height,
        zIndex: 30,
        pointerEvents: "none",
        ["--ambient-mini-name" as string]: JSON.stringify(name),
      }}
    >
      <PrototypeCharacter size={164} wingMotion="off" />
    </div>
  );
}

function laneById(lanes: readonly AmbientHorizontalLane[], id: string) {
  return lanes.find((lane) => lane.id === id);
}

export function AmbientHouseEditor() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<DragHandle>(null);
  const laneMoveRef = useRef<LaneMove>(null);
  const frameRef = useRef<number | null>(null);

  const [scale, setScale] = useState(1);
  const [snap, setSnap] = useState(1);
  const [mode, setMode] = useState<EditMode>("lane");
  const [draft, setDraft] = useState<AmbientMotionGraphRaw>(canonicalDraft);
  const [selection, setSelection] = useState<Selection>(null);
  const [defaultDepth, setDefaultDepth] = useState<AmbientLaneDepth>("front");
  const [drawingLane, setDrawingLane] = useState<{ start: AmbientHousePoint; endX: number } | null>(null);
  const [drawingConnector, setDrawingConnector] = useState<{ from: AmbientHousePoint; to: AmbientHousePoint } | null>(null);
  const [testChar, setTestChar] = useState<TestCharPlacement | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [showSimBody, setShowSimBody] = useState(true);
  const [simAgents, setSimAgents] = useState<SimAgent[]>([]);
  const [demo, setDemo] = useState(false);
  const [status, setStatus] = useState("DRAW HORIZONTAL: drag left/right. Y is locked at 0°. Drag an existing lane body to translate it in parallel.");

  const canonical = useMemo(() => canonicalizeAmbientMotionGraph(draft), [draft]);
  const graphLaneById = useMemo(() => new Map(canonical.horizontalLanes.map((lane) => [lane.id, lane])), [canonical.horizontalLanes]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as AmbientMotionGraphRaw;
      if (
        parsed.canvas?.width === 1920 &&
        parsed.canvas?.height === 1080 &&
        parsed.miniCharacter?.anchor === "center" &&
        Array.isArray(parsed.horizontalLanes) &&
        Array.isArray(parsed.rawConnectors)
      ) {
        setDraft(parsed);
        setStatus("Loaded saved lane graph draft from localStorage.");
      }
    } catch {
      // Keep clean graph.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

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

  function clientToCanonical(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return null;
    return roundPoint({ x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }, snap);
  }

  function updateLane(id: string, updater: (lane: AmbientHorizontalLane) => AmbientHorizontalLane) {
    setDraft((current) => ({
      ...current,
      horizontalLanes: current.horizontalLanes.map((lane) => lane.id === id ? normalizeAmbientHorizontalLane(updater(lane)) : lane),
    }));
  }

  function updateConnector(id: string, updater: (connector: AmbientRawConnector) => AmbientRawConnector) {
    setDraft((current) => ({
      ...current,
      rawConnectors: current.rawConnectors.map((connector) => connector.id === id ? updater(connector) : connector),
    }));
  }

  function setEditorMode(nextMode: EditMode) {
    setMode(nextMode);
    setSelection(null);
    setSimulate(false);
    setStatus(nextMode === "lane"
      ? "DRAW HORIZONTAL mode. Drag empty space to create a 0° lane; drag an existing lane body to translate it."
      : nextMode === "connector"
        ? "DRAW CONNECTOR mode. Draw a diagonal across horizontal lanes; orphan tails will be trimmed from canonical output."
        : "PLACE TEST CHAR mode. Click a horizontal lane or a canonical connector segment.");
  }

  function nearestLane(point: AmbientHousePoint, maxDistance = 30) {
    let best: { lane: AmbientHorizontalLane; distance: number; x: number } | null = null;
    for (const sourceLane of canonical.horizontalLanes) {
      const lane = normalizeAmbientHorizontalLane(sourceLane);
      const x = clamp(point.x, lane.x1, lane.x2);
      const distance = Math.hypot(point.x - x, point.y - lane.y);
      if (distance <= maxDistance && (!best || distance < best.distance)) best = { lane, distance, x };
    }
    return best;
  }

  function nearestConnector(point: AmbientHousePoint, maxDistance = 30) {
    let best: { connector: AmbientCanonicalConnector; distance: number; t: number; point: AmbientHousePoint } | null = null;
    for (const connector of canonical.connectors) {
      const projected = projectPointToSegment(point, connector.from, connector.to);
      if (projected.distance <= maxDistance && (!best || projected.distance < best.distance)) {
        best = { connector, ...projected };
      }
    }
    return best;
  }

  function placeTestChar(point: AmbientHousePoint) {
    const laneCandidate = nearestLane(point);
    const connectorCandidate = nearestConnector(point);

    if (connectorCandidate && (!laneCandidate || connectorCandidate.distance <= laneCandidate.distance)) {
      const { connector, t } = connectorCandidate;
      setTestChar({ kind: "connector", connectorId: connector.id, sourceRawId: connector.sourceRawId, t });
      setSelection({ kind: "connector", id: connector.sourceRawId });
      const sourceLane = graphLaneById.get(connector.from.laneId);
      setStatus(`Test char placed on ${connector.id} · connector uses source lane ${connector.from.laneId} depth (${(sourceLane?.midLayer ?? "front").toUpperCase()} MID) until arrival.`);
      return;
    }

    if (laneCandidate) {
      setTestChar({ kind: "lane", laneId: laneCandidate.lane.id, x: laneCandidate.x });
      setSelection({ kind: "lane", id: laneCandidate.lane.id });
      setStatus(`Test char placed on ${laneCandidate.lane.id} · ${laneCandidate.lane.midLayer.toUpperCase()} MID.`);
      return;
    }

    setStatus("No lane or canonical connector within 30px of the test point.");
  }

  function cloneSelectedLane() {
    if (!selection || selection.kind !== "lane") return;
    const source = laneById(draft.horizontalLanes, selection.id);
    if (!source) return;

    const lane = normalizeAmbientHorizontalLane(source);
    const length = laneLength(lane);
    const x1 = lane.x2 + LANE_CLONE_GAP_PX;
    const x2 = x1 + length;
    if (x2 > AMBIENT_HOUSE_CANVAS.width) {
      setStatus(`Cannot clone ${lane.id}: endpoint + ${LANE_CLONE_GAP_PX}px would exceed canvas width.`);
      return;
    }

    const id = nextId("lane", draft.horizontalLanes.map((item) => item.id));
    const clone: AmbientHorizontalLane = { id, y: lane.y, x1, x2, midLayer: lane.midLayer };
    setDraft((current) => ({ ...current, horizontalLanes: [...current.horizontalLanes, clone] }));
    setSelection({ kind: "lane", id });
    setMode("lane");
    setTestChar(null);
    setStatus(`${id} cloned from ${lane.id} · same Y ${lane.y} · starts at previous endpoint + ${LANE_CLONE_GAP_PX}px.`);
  }

  function deleteSelected() {
    if (!selection) return;
    if (selection.kind === "lane") {
      setDraft((current) => ({ ...current, horizontalLanes: current.horizontalLanes.filter((lane) => lane.id !== selection.id) }));
      if (testChar?.kind === "lane" && testChar.laneId === selection.id) setTestChar(null);
    } else {
      setDraft((current) => ({ ...current, rawConnectors: current.rawConnectors.filter((connector) => connector.id !== selection.id) }));
      if (testChar?.kind === "connector" && testChar.sourceRawId === selection.id) setTestChar(null);
    }
    setSelection(null);
    setStatus("Deleted selected graph element.");
  }

  function toggleSelectedLaneDepth() {
    if (!selection || selection.kind !== "lane") return;
    updateLane(selection.id, (lane) => ({ ...lane, midLayer: lane.midLayer === "front" ? "behind" : "front" }));
    setStatus(`Toggled ${selection.id} FRONT / BEHIND MID.`);
  }

  async function copyRawJson() {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
    setStatus("Copied RAW lane graph.");
  }

  async function copyCanonicalJson() {
    await navigator.clipboard.writeText(JSON.stringify(canonical, null, 2));
    setStatus(`Copied canonical preview · ${canonical.connectors.length} valid connector segments · ${canonical.droppedRawConnectorIds.length} orphan raw lines dropped.`);
  }

  function resetGraph() {
    setDraft(canonicalDraft());
    setSelection(null);
    setTestChar(null);
    setSimulate(false);
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus("Reset lane graph. Draw horizontal lanes first, then diagonals.");
  }

  function toggleSimulation() {
    if (!canonical.horizontalLanes.length) {
      setStatus("Need at least one horizontal lane before simulation.");
      return;
    }
    setSimulate((value) => !value);
    setTestChar(null);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        if (demo) {
          event.preventDefault();
          setDemo(false);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "d") {
        if (selection?.kind === "lane") {
          event.preventDefault();
          cloneSelectedLane();
        }
        return;
      }

      if (event.altKey && key === "r") {
        event.preventDefault();
        void copyRawJson();
        return;
      }
      if (event.altKey && key === "c") {
        event.preventDefault();
        void copyCanonicalJson();
        return;
      }
      if (event.altKey && key === "0") {
        event.preventDefault();
        setSnap(0);
        setStatus("Snap OFF.");
        return;
      }
      if (event.altKey && key === "1") {
        event.preventDefault();
        setSnap(1);
        setStatus("Snap 1px.");
        return;
      }
      if (event.altKey && key === "5") {
        event.preventDefault();
        setSnap(5);
        setStatus("Snap 5px.");
        return;
      }
      if (event.altKey && key === "9") {
        event.preventDefault();
        setSnap(10);
        setStatus("Snap 10px.");
        return;
      }

      if (event.shiftKey && key === "r") {
        event.preventDefault();
        resetGraph();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selection) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (key === "h") {
        event.preventDefault();
        setEditorMode("lane");
      } else if (key === "c") {
        event.preventDefault();
        setEditorMode("connector");
      } else if (key === "p") {
        event.preventDefault();
        setEditorMode("test");
      } else if (key === "f") {
        event.preventDefault();
        setDefaultDepth("front");
        setStatus("New lane default depth: CHAR FRONT MID.");
      } else if (key === "b") {
        event.preventDefault();
        setDefaultDepth("behind");
        setStatus("New lane default depth: CHAR BEHIND MID.");
      } else if (key === "t") {
        if (selection?.kind === "lane") {
          event.preventDefault();
          toggleSelectedLaneDepth();
        }
      } else if (key === "s") {
        event.preventDefault();
        toggleSimulation();
      } else if (key === "v") {
        if (simulate) {
          event.preventDefault();
          setShowSimBody((value) => !value);
        }
      } else if (key === "g") {
        event.preventDefault();
        setDemo((value) => !value);
        setSelection(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canonical, demo, draft, selection, simulate, testChar]);

  function onStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (dragHandleRef.current || laneMoveRef.current || simulate) return;
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;

    if (mode === "lane") {
      setDrawingLane({ start: point, endX: point.x });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (mode === "connector") {
      setDrawingConnector({ from: point, to: point });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    placeTestChar(point);
  }

  function onStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;

    const laneMove = laneMoveRef.current;
    if (laneMove) {
      const source = normalizeAmbientHorizontalLane(laneMove.laneStart);
      const dxRaw = point.x - laneMove.pointerStart.x;
      const dy = point.y - laneMove.pointerStart.y;
      let dx = dxRaw;
      if (source.x1 + dx < 0) dx = -source.x1;
      if (source.x2 + dx > AMBIENT_HOUSE_CANVAS.width) dx = AMBIENT_HOUSE_CANVAS.width - source.x2;
      const y = clamp(source.y + dy, 0, AMBIENT_HOUSE_CANVAS.height);
      updateLane(laneMove.id, (lane) => ({ ...lane, x1: source.x1 + dx, x2: source.x2 + dx, y }));
      return;
    }

    const handle = dragHandleRef.current;
    if (handle) {
      if (handle.kind === "lane-start") {
        updateLane(handle.id, (lane) => ({ ...lane, x1: Math.min(point.x, lane.x2 - 10) }));
      } else if (handle.kind === "lane-end") {
        updateLane(handle.id, (lane) => ({ ...lane, x2: Math.max(point.x, lane.x1 + 10) }));
      } else if (handle.kind === "connector-from") {
        updateConnector(handle.id, (connector) => ({ ...connector, from: point }));
      } else {
        updateConnector(handle.id, (connector) => ({ ...connector, to: point }));
      }
      return;
    }

    if (drawingLane) {
      setDrawingLane((current) => current ? { ...current, endX: point.x } : current);
      return;
    }

    if (drawingConnector) {
      setDrawingConnector((current) => current ? { ...current, to: point } : current);
    }
  }

  function onStagePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (laneMoveRef.current) {
      const id = laneMoveRef.current.id;
      laneMoveRef.current = null;
      setStatus(`${id} translated in parallel · 0° preserved · length unchanged.`);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (dragHandleRef.current) {
      dragHandleRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (drawingLane) {
      const x1 = Math.min(drawingLane.start.x, drawingLane.endX);
      const x2 = Math.max(drawingLane.start.x, drawingLane.endX);
      if (x2 - x1 >= 30) {
        const id = nextId("lane", draft.horizontalLanes.map((lane) => lane.id));
        const lane: AmbientHorizontalLane = { id, y: drawingLane.start.y, x1, x2, midLayer: defaultDepth };
        setDraft((current) => ({ ...current, horizontalLanes: [...current.horizontalLanes, lane] }));
        setSelection({ kind: "lane", id });
        setStatus(`${id} created at Y ${lane.y}. Horizontal is hard-locked; endpoint handles only change length.`);
      }
      setDrawingLane(null);
    }

    if (drawingConnector) {
      const distance = Math.hypot(drawingConnector.to.x - drawingConnector.from.x, drawingConnector.to.y - drawingConnector.from.y);
      const verticalChange = Math.abs(drawingConnector.to.y - drawingConnector.from.y);
      if (distance >= 30 && verticalChange >= 8) {
        const id = nextId("connector", draft.rawConnectors.map((connector) => connector.id));
        const connector: AmbientRawConnector = { id, from: drawingConnector.from, to: drawingConnector.to };
        setDraft((current) => ({ ...current, rawConnectors: [...current.rawConnectors, connector] }));
        setSelection({ kind: "connector", id });
        const intersections = intersectRawConnectorWithLanes(connector, draft.horizontalLanes);
        setStatus(`${id} raw line created · ${intersections.length} lane intersections. Orphan tails are ignored by canonical preview.`);
      }
      setDrawingConnector(null);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function beginHandle(event: React.PointerEvent<SVGCircleElement>, handle: NonNullable<DragHandle>, selectionValue: Selection) {
    event.stopPropagation();
    dragHandleRef.current = handle;
    setSelection(selectionValue);
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function beginLaneMove(event: React.PointerEvent<SVGLineElement>, lane: AmbientHorizontalLane) {
    event.stopPropagation();
    if (simulate || mode === "test") return;
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;
    const normalized = normalizeAmbientHorizontalLane(lane);
    laneMoveRef.current = { id: normalized.id, pointerStart: point, laneStart: normalized };
    setSelection({ kind: "lane", id: normalized.id });
    setMode("lane");
    setTestChar(null);
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function placeTestFromCanonicalConnector(event: React.PointerEvent<SVGLineElement>, connector: AmbientCanonicalConnector) {
    if (mode !== "test" || simulate) return;
    event.stopPropagation();
    const point = clientToCanonical(event.clientX, event.clientY);
    if (!point) return;
    const projected = projectPointToSegment(point, connector.from, connector.to);
    setTestChar({ kind: "connector", connectorId: connector.id, sourceRawId: connector.sourceRawId, t: projected.t });
    setSelection({ kind: "connector", id: connector.sourceRawId });
    const sourceLane = graphLaneById.get(connector.from.laneId);
    setStatus(`Test char placed on ${connector.id} · source depth ${(sourceLane?.midLayer ?? "front").toUpperCase()} MID.`);
  }

  useEffect(() => {
    if (!simulate) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      setSimAgents([]);
      return;
    }

    const usableLanes = canonical.horizontalLanes.filter((lane) => laneLength(lane) >= 30);
    if (!usableLanes.length) {
      setSimulate(false);
      setStatus("Need at least one horizontal lane before simulation.");
      return;
    }

    const now = performance.now();
    const initial: SimAgent[] = Array.from({ length: 10 }, (_, id) => {
      const lane = usableLanes[Math.floor(Math.random() * usableLanes.length)];
      const x = lane.x1 + Math.random() * Math.max(1, lane.x2 - lane.x1);
      const position = { x, y: lane.y };
      return {
        id,
        name: LEARNER_NAME,
        position,
        currentLaneId: lane.id,
        depth: lane.midLayer,
        phase: "pause",
        moveKind: "lane",
        from: position,
        target: position,
        pauseUntil: now + Math.random() * 1200,
        moveStartedAt: now,
        durationMs: 0,
      };
    });
    setSimAgents(initial);

    const startMove = (
      agent: SimAgent,
      target: AmbientHousePoint,
      time: number,
      moveKind: "lane" | "connector",
      extras: Partial<SimAgent> = {},
    ): SimAgent => {
      const distance = Math.hypot(target.x - agent.position.x, target.y - agent.position.y);
      const speed = 55 + Math.random() * 35;
      return {
        ...agent,
        ...extras,
        from: agent.position,
        target,
        phase: "move",
        moveKind,
        moveStartedAt: time,
        durationMs: Math.max(180, (distance / speed) * 1000),
      };
    };

    const tick = (time: number) => {
      setSimAgents((current) => current.map((agent) => {
        const lane = graphLaneById.get(agent.currentLaneId);
        if (!lane) return agent;

        if (agent.phase === "pause") {
          if (time < agent.pauseUntil) return agent;

          if (agent.pendingConnectorId) {
            const connector = canonical.connectors.find((item) => item.id === agent.pendingConnectorId);
            if (connector) {
              const fromCurrent = connector.from.laneId === agent.currentLaneId;
              const source = fromCurrent ? connector.from : connector.to;
              const target = fromCurrent ? connector.to : connector.from;
              const atJunction = Math.hypot(agent.position.x - source.x, agent.position.y - source.y) < 4;
              if (atJunction) return startMove(agent, target, time, "connector", { targetLaneId: target.laneId });
            }
          }

          const attached = canonical.connectors.filter((connector) => connector.from.laneId === lane.id || connector.to.laneId === lane.id);
          if (attached.length && Math.random() < 0.38) {
            const connector = attached[Math.floor(Math.random() * attached.length)];
            const junction = connector.from.laneId === lane.id ? connector.from : connector.to;
            const distanceToJunction = Math.abs(agent.position.x - junction.x);
            if (distanceToJunction < 4) {
              const target = connector.from.laneId === lane.id ? connector.to : connector.from;
              return startMove(agent, target, time, "connector", {
                pendingConnectorId: connector.id,
                targetLaneId: target.laneId,
              });
            }
            return startMove(agent, { x: junction.x, y: lane.y }, time, "lane", { pendingConnectorId: connector.id });
          }

          const targetX = lane.x1 + Math.random() * Math.max(1, lane.x2 - lane.x1);
          return startMove(agent, { x: targetX, y: lane.y }, time, "lane", {
            pendingConnectorId: undefined,
            targetLaneId: undefined,
          });
        }

        const progress = Math.min(1, (time - agent.moveStartedAt) / Math.max(1, agent.durationMs));
        const position = {
          x: agent.from.x + (agent.target.x - agent.from.x) * progress,
          y: agent.from.y + (agent.target.y - agent.from.y) * progress,
        };

        if (progress < 1) return { ...agent, position };

        if (agent.moveKind === "connector" && agent.targetLaneId) {
          const targetLane = graphLaneById.get(agent.targetLaneId);
          return {
            ...agent,
            position: agent.target,
            currentLaneId: agent.targetLaneId,
            depth: targetLane?.midLayer ?? agent.depth,
            phase: "pause",
            pauseUntil: time + 350 + Math.random() * 900,
            pendingConnectorId: undefined,
            targetLaneId: undefined,
          };
        }

        return {
          ...agent,
          position: agent.target,
          phase: "pause",
          pauseUntil: time + 450 + Math.random() * 1400,
        };
      }));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [simulate, canonical, graphLaneById]);

  const selectedLane = selection?.kind === "lane" ? laneById(draft.horizontalLanes, selection.id) : undefined;
  const testLane = testChar?.kind === "lane" ? laneById(canonical.horizontalLanes, testChar.laneId) : undefined;
  const testConnector = testChar?.kind === "connector" ? canonical.connectors.find((connector) => connector.id === testChar.connectorId) : undefined;
  const testPosition = testChar?.kind === "lane" && testLane
    ? pointOnLane(testLane, testChar.x)
    : testChar?.kind === "connector" && testConnector
      ? pointOnConnector(testConnector, testChar.t)
      : null;
  const testDepth: AmbientLaneDepth | undefined = testChar?.kind === "lane" && testLane
    ? testLane.midLayer
    : testConnector
      ? graphLaneById.get(testConnector.from.laneId)?.midLayer ?? "front"
      : undefined;

  const behindAgents = simAgents.filter((agent) => agent.depth === "behind");
  const frontAgents = simAgents.filter((agent) => agent.depth === "front");

  const lanePreview = drawingLane ? normalizeAmbientHorizontalLane({
    id: "preview",
    y: drawingLane.start.y,
    x1: drawingLane.start.x,
    x2: drawingLane.endX,
    midLayer: defaultDepth,
  }) : null;

  const rawValidity = useMemo(() => new Map(draft.rawConnectors.map((connector) => [
    connector.id,
    intersectRawConnectorWithLanes(connector, draft.horizontalLanes).length >= 2,
  ])), [draft.rawConnectors, draft.horizontalLanes]);

  return (
    <div ref={viewportRef} style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#101711", color: "white", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920 * scale, height: 1080 * scale, transform: "translate(-50%, -50%)" }}>
        <div
          ref={stageRef}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={() => {
            dragHandleRef.current = null;
            laneMoveRef.current = null;
            setDrawingLane(null);
            setDrawingConnector(null);
          }}
          style={{ position: "absolute", inset: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0", overflow: "hidden", touchAction: "none", userSelect: "none", isolation: "isolate" }}
        >
          <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 10, pointerEvents: "none" }} />

          {!simulate && testPosition && testDepth === "behind" ? <MiniCharacterView anchor={testPosition} /> : null}
          {simulate ? behindAgents.map((agent) => <MiniCharacterView key={`behind-${agent.id}`} anchor={agent.position} name={agent.name} showBodySection={showSimBody} />) : null}

          <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 20, pointerEvents: "none" }} />

          {!simulate && testPosition && testDepth === "front" ? <MiniCharacterView anchor={testPosition} /> : null}
          {simulate ? frontAgents.map((agent) => <MiniCharacterView key={`front-${agent.id}`} anchor={agent.position} name={agent.name} showBodySection={showSimBody} />) : null}

          <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 50, pointerEvents: "none" }} />

          {!demo ? (
            <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ position: "absolute", inset: 0, zIndex: 60, overflow: "visible", pointerEvents: "none" }}>
              {draft.horizontalLanes.map((sourceLane) => {
                const lane = normalizeAmbientHorizontalLane(sourceLane);
                const selected = selection?.kind === "lane" && selection.id === lane.id;
                return (
                  <g key={lane.id}>
                    <line
                      x1={lane.x1} y1={lane.y} x2={lane.x2} y2={lane.y}
                      stroke={LANE_COLORS[lane.midLayer]}
                      strokeWidth={selected ? 10 : 7}
                      opacity={selected ? 1 : .82}
                      style={{ pointerEvents: mode === "test" ? "none" : "auto", cursor: "move" }}
                      onPointerDown={(event) => beginLaneMove(event, lane)}
                    />
                    <text x={(lane.x1 + lane.x2) / 2} y={lane.y - 12} textAnchor="middle" fill="#fff" fontSize="15" stroke="#000" strokeWidth="3" paintOrder="stroke">
                      {lane.id} · {lane.midLayer === "front" ? "FRONT MID" : "BEHIND MID"}
                    </text>
                    <circle cx={lane.x1} cy={lane.y} r="10" fill="#fff" stroke={LANE_COLORS[lane.midLayer]} strokeWidth="4" style={{ pointerEvents: mode === "test" ? "none" : "auto", cursor: "ew-resize" }} onPointerDown={(event) => beginHandle(event, { kind: "lane-start", id: lane.id }, { kind: "lane", id: lane.id })} />
                    <circle cx={lane.x2} cy={lane.y} r="10" fill="#fff" stroke={LANE_COLORS[lane.midLayer]} strokeWidth="4" style={{ pointerEvents: mode === "test" ? "none" : "auto", cursor: "ew-resize" }} onPointerDown={(event) => beginHandle(event, { kind: "lane-end", id: lane.id }, { kind: "lane", id: lane.id })} />
                  </g>
                );
              })}

              {lanePreview ? <line x1={lanePreview.x1} y1={lanePreview.y} x2={lanePreview.x2} y2={lanePreview.y} stroke={LANE_COLORS[lanePreview.midLayer]} strokeWidth="8" strokeDasharray="14 8" opacity=".9" /> : null}

              {draft.rawConnectors.map((connector) => {
                const selected = selection?.kind === "connector" && selection.id === connector.id;
                const valid = rawValidity.get(connector.id);
                const intersections = intersectRawConnectorWithLanes(connector, draft.horizontalLanes);
                return (
                  <g key={connector.id}>
                    <line
                      x1={connector.from.x} y1={connector.from.y} x2={connector.to.x} y2={connector.to.y}
                      stroke={valid ? "#ff78d1" : "#ff6f6f"}
                      strokeWidth={selected ? 6 : 4}
                      strokeDasharray="10 8"
                      opacity={valid ? .55 : .72}
                      style={{ pointerEvents: mode === "test" ? "none" : "auto", cursor: "pointer" }}
                      onPointerDown={(event) => { event.stopPropagation(); setSelection({ kind: "connector", id: connector.id }); }}
                    />
                    {intersections.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="7" fill="#fff" stroke="#ff78d1" strokeWidth="3" />)}
                    <circle cx={connector.from.x} cy={connector.from.y} r="9" fill="#fff" stroke="#ff78d1" strokeWidth="4" style={{ pointerEvents: mode === "test" ? "none" : "auto", cursor: "move" }} onPointerDown={(event) => beginHandle(event, { kind: "connector-from", id: connector.id }, { kind: "connector", id: connector.id })} />
                    <circle cx={connector.to.x} cy={connector.to.y} r="9" fill="#fff" stroke="#ff78d1" strokeWidth="4" style={{ pointerEvents: mode === "test" ? "none" : "auto", cursor: "move" }} onPointerDown={(event) => beginHandle(event, { kind: "connector-to", id: connector.id }, { kind: "connector", id: connector.id })} />
                  </g>
                );
              })}

              {drawingConnector ? <line x1={drawingConnector.from.x} y1={drawingConnector.from.y} x2={drawingConnector.to.x} y2={drawingConnector.to.y} stroke="#ff78d1" strokeWidth="5" strokeDasharray="10 8" opacity=".9" /> : null}

              {canonical.connectors.map((connector) => (
                <line
                  key={connector.id}
                  x1={connector.from.x} y1={connector.from.y} x2={connector.to.x} y2={connector.to.y}
                  stroke={testChar?.kind === "connector" && testChar.connectorId === connector.id ? "#ffffff" : "#7dffd7"}
                  strokeWidth={testChar?.kind === "connector" && testChar.connectorId === connector.id ? 9 : 5}
                  opacity=".9"
                  style={{ pointerEvents: mode === "test" ? "auto" : "none", cursor: mode === "test" ? "crosshair" : "default" }}
                  onPointerDown={(event) => placeTestFromCanonicalConnector(event, connector)}
                />
              ))}

              {testPosition && !simulate ? <circle cx={testPosition.x} cy={testPosition.y} r="7" fill="#fff" stroke={testDepth === "behind" ? LANE_COLORS.behind : LANE_COLORS.front} strokeWidth="4" /> : null}
              {simulate ? simAgents.map((agent) => <circle key={`agent-dot-${agent.id}`} cx={agent.position.x} cy={agent.position.y} r="4" fill={LANE_COLORS[agent.depth]} />) : null}
            </svg>
          ) : null}
        </div>
      </div>

      {!demo ? (
        <aside style={{ position: "absolute", left: 18, top: 18, zIndex: 100, width: 440, maxHeight: "calc(100vh - 36px)", overflowY: "auto", padding: 14, borderRadius: 16, background: "#0d1510ed", border: "1px solid #ffffff22", backdropFilter: "blur(10px)" }}>
          <strong style={{ display: "block", fontSize: 12, letterSpacing: ".1em", color: "#f1d17b" }}>AMBIENT MOTION GRAPH EDITOR</strong>
          <div style={{ marginTop: 4, fontSize: 12, opacity: .75 }}>1920×1080 · horizontal lanes + diagonal connectors</div>
          <div style={{ marginTop: 7, padding: 8, borderRadius: 10, background: "#ffffff0b", fontSize: 11, lineHeight: 1.45 }}>
            PLACE TEST CHAR now snaps to horizontal lanes or canonical diagonal connector segments. Connector test depth follows its source lane until the next lane.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 12 }}>
            <button onClick={() => setEditorMode("lane")} style={{ padding: "8px 5px", borderRadius: 9, border: "1px solid #ffffff24", background: mode === "lane" ? "#f0d076" : "#ffffff10", color: mode === "lane" ? "#1d251e" : "#fff", fontWeight: 700, fontSize: 11 }}>DRAW HORIZONTAL · H</button>
            <button onClick={() => setEditorMode("connector")} style={{ padding: "8px 5px", borderRadius: 9, border: "1px solid #ffffff24", background: mode === "connector" ? "#f0d076" : "#ffffff10", color: mode === "connector" ? "#1d251e" : "#fff", fontWeight: 700, fontSize: 11 }}>DRAW CONNECTOR · C</button>
            <button onClick={() => setEditorMode("test")} style={{ padding: "8px 5px", borderRadius: 9, border: "1px solid #ffffff24", background: mode === "test" ? "#f0d076" : "#ffffff10", color: mode === "test" ? "#1d251e" : "#fff", fontWeight: 700, fontSize: 11 }}>PLACE TEST CHAR · P</button>
          </div>

          <div style={{ marginTop: 10, padding: 8, borderRadius: 9, background: "#ffffff08", fontSize: 10, lineHeight: 1.55 }}>
            <strong>SHORTCUTS</strong><br />
            H horizontal · C connector · P test char · F default front · B default behind · T toggle selected depth<br />
            S simulate · V body section · Ctrl+D clone lane · Del delete · G demo / Esc exit<br />
            Alt+0 snap off · Alt+1 1px · Alt+5 5px · Alt+9 10px · Alt+R raw JSON · Alt+C clean JSON · Shift+R reset
          </div>

          <div style={{ marginTop: 13, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", opacity: .66 }}>NEW LANE DEFAULT DEPTH</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={() => setDefaultDepth("front")} style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: `1px solid ${LANE_COLORS.front}88`, background: defaultDepth === "front" ? LANE_COLORS.front : "#ffffff0d", color: defaultDepth === "front" ? "#111" : "#fff", fontWeight: 800 }}>CHAR FRONT MID · F</button>
            <button onClick={() => setDefaultDepth("behind")} style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: `1px solid ${LANE_COLORS.behind}88`, background: defaultDepth === "behind" ? LANE_COLORS.behind : "#ffffff0d", color: defaultDepth === "behind" ? "#111" : "#fff", fontWeight: 800 }}>CHAR BEHIND MID · B</button>
          </div>

          {selectedLane ? (
            <div style={{ marginTop: 12, padding: 9, borderRadius: 10, border: `1px solid ${LANE_COLORS[selectedLane.midLayer]}66`, background: "#ffffff08", fontSize: 11 }}>
              <strong>{selectedLane.id}</strong> · Y {selectedLane.y} · X {Math.round(selectedLane.x1)}→{Math.round(selectedLane.x2)} · {selectedLane.midLayer.toUpperCase()} MID
              <button onClick={toggleSelectedLaneDepth} style={{ display: "block", width: "100%", marginTop: 7, padding: "7px", borderRadius: 8, border: "1px solid #ffffff22", background: "#ffffff10", color: "#fff", fontWeight: 700 }}>TOGGLE FRONT / BEHIND MID · T</button>
              <button onClick={cloneSelectedLane} style={{ display: "block", width: "100%", marginTop: 6, padding: "7px", borderRadius: 8, border: "1px solid #ffffff22", background: "#ffffff10", color: "#fff", fontWeight: 700 }}>CLONE LANE +20px · Ctrl+D</button>
            </div>
          ) : null}

          <button onClick={toggleSimulation} disabled={!canonical.horizontalLanes.length} style={{ width: "100%", marginTop: 12, padding: "10px 12px", borderRadius: 10, border: simulate ? "1px solid #ff8d8d" : "1px solid #7de5aa", background: simulate ? "#5b2424" : "#174b31", color: "#fff", fontWeight: 800 }}>
            {simulate ? "STOP SIMULATION · S" : "SIMULATE GRAPH ×10 · S"}
          </button>
          {simulate ? (
            <button onClick={() => setShowSimBody((value) => !value)} style={{ width: "100%", marginTop: 6, padding: "8px", borderRadius: 9, border: "1px solid #ffffff22", background: "#ffffff0d", color: "#fff", fontWeight: 700 }}>
              BODY SECTION {showSimBody ? "ON" : "OFF"} · V
            </button>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12 }}>
            <span>SNAP</span>
            {([0, 1, 5, 10] as const).map((value) => {
              const shortcut = value === 0 ? "Alt+0" : value === 10 ? "Alt+9" : `Alt+${value}`;
              return <button key={value} onClick={() => setSnap(value)} style={{ borderRadius: 8, border: "1px solid #ffffff20", padding: "5px 7px", background: snap === value ? "#fff" : "#ffffff0d", color: snap === value ? "#111" : "#fff" }}>{value === 0 ? "OFF" : `${value}px`} · {shortcut}</button>;
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.55 }}>
            <div>Horizontal lanes: <strong>{draft.horizontalLanes.length}</strong></div>
            <div>Raw connectors: <strong>{draft.rawConnectors.length}</strong></div>
            <div>Canonical connector segments: <strong>{canonical.connectors.length}</strong></div>
            <div style={{ color: canonical.droppedRawConnectorIds.length ? "#ff9d9d" : "#bdebd0" }}>Orphan raw connectors: <strong>{canonical.droppedRawConnectorIds.length}</strong></div>
            <div><span style={{ color: LANE_COLORS.front }}>●</span> FRONT MID · <span style={{ color: LANE_COLORS.behind }}>●</span> BEHIND MID</div>
            <div><span style={{ color: "#ff78d1" }}>--- raw diagonal</span> · <span style={{ color: "#7dffd7" }}>━ canonical connector</span></div>
            {testChar?.kind === "connector" && testConnector ? <div>Test connector: <strong>{testConnector.id}</strong> · t {testChar.t.toFixed(2)} · source {testConnector.from.laneId}</div> : null}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <button onClick={deleteSelected} disabled={!selection} style={{ padding: "7px 9px" }}>Delete · Del</button>
            <button onClick={copyRawJson} style={{ padding: "7px 9px" }}>RAW JSON · Alt+R</button>
            <button onClick={copyCanonicalJson} style={{ padding: "7px 9px" }}>CLEAN JSON · Alt+C</button>
            <button onClick={resetGraph} style={{ padding: "7px 9px" }}>Reset · Shift+R</button>
            <button onClick={() => { setDemo(true); setSelection(null); }} style={{ padding: "7px 12px", background: "#f0d076", color: "#162018", border: 0, borderRadius: 8, fontWeight: 800 }}>DEMO · G</button>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: "#cdd7ce", opacity: .86 }}>{status}</div>
          <div style={{ marginTop: 7, fontSize: 10, opacity: .55 }}>Connector test/simulation keeps the source lane MID depth until reaching the next horizontal lane.</div>
        </aside>
      ) : (
        <button onClick={() => setDemo(false)} style={{ position: "fixed", right: 18, top: 18, zIndex: 120, padding: "8px 11px", borderRadius: 999, border: "1px solid #ffffff2d", background: "#101711aa", color: "#fff", fontSize: 11, fontWeight: 700 }}>EXIT DEMO · Esc</button>
      )}
    </div>
  );
}
