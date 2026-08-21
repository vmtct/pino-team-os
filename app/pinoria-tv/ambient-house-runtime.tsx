"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import savedAreas from "./ambient-house-areas.saved.json";
import savedGraph from "./ambient-house-motion-graph.saved.json";
import {
  AMBIENT_HOUSE_CANVAS,
  AMBIENT_MINI_CHARACTER,
  ambientMiniCharacterTopLeftFromAnchor,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";
import {
  canonicalizeAmbientMotionGraph,
  normalizeAmbientHorizontalLane,
  type AmbientCanonicalConnector,
  type AmbientHorizontalLane,
  type AmbientLaneDepth,
  type AmbientMotionGraphRaw,
} from "./ambient-house-motion-graph";
import { PrototypeCharacter } from "./prototype-assets";

type AreaId = "reception" | "artchitect" | "little-piner" | "pianohouse";
type AreaBoundary = { id: AreaId; label: string; points: AmbientHousePoint[] };
type AreaSnapshot = { canvas: { width: number; height: number }; areas: AreaBoundary[] };

export type AmbientRuntimeSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
};

type LaneInterval = {
  laneId: string;
  y: number;
  x1: number;
  x2: number;
  midLayer: AmbientLaneDepth;
};

type RouteEdge = {
  from: AmbientHousePoint;
  to: AmbientHousePoint;
  fromLaneId: string;
  toLaneId: string;
  kind: "lane" | "connector";
};

type RuntimeMove = RouteEdge & {
  startedAt: number;
  durationMs: number;
};

type AgentState = {
  position: AmbientHousePoint;
  laneId: string;
  plane: AmbientLaneDepth;
  phase: "transit" | "wander";
  route: RouteEdge[];
  routeIndex: number;
  move: RuntimeMove | null;
  pendingConnectorId?: string;
  pauseUntil: number;
};

const GRAPH = canonicalizeAmbientMotionGraph(savedGraph as AmbientMotionGraphRaw);
const AREA_SNAPSHOT = savedAreas as AreaSnapshot;
const ASSET_VERSION = "ambient-house-1920-20260821-runtime-area-v1";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};
const ENTRY_REFERENCE: AmbientHousePoint = { x: 170, y: 931 };
const Z_BEHIND_BASE = 1_000;
const Z_MID = 500_000_000;
const Z_FRONT_BASE = 600_000_000;
const Z_HOUSE_FRONT = 1_100_000_000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pointOnSegment(point: AmbientHousePoint, a: AmbientHousePoint, b: AmbientHousePoint, epsilon = 0.75) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -epsilon) return false;
  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= squaredLength + epsilon;
}

function pointInPolygon(point: AmbientHousePoint, polygon: readonly AmbientHousePoint[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[previousIndex];
    const b = polygon[index];
    if (pointOnSegment(point, a, b)) return true;
    const crosses = (b.y > point.y) !== (a.y > point.y);
    if (!crosses) continue;
    const x = ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

function inferArea(subject: AmbientRuntimeSubject): AreaId {
  const value = `${subject.path} ${subject.room}`.toLocaleLowerCase("vi-VN");
  if (value.includes("artchitect") || value.includes("phòng họa") || value.includes("my thuat") || value.includes("mỹ thuật")) return "artchitect";
  if (value.includes("piano") || value.includes("phòng đàn") || value.includes("phong dan")) return "pianohouse";
  if (value.includes("little piner") || value.includes("mầm non") || value.includes("mam non")) return "little-piner";
  return "reception";
}

function areaBoundary(areaId: AreaId) {
  return AREA_SNAPSHOT.areas.find((area) => area.id === areaId) ?? AREA_SNAPSHOT.areas[0];
}

function laneIntervalsInsidePolygon(laneSource: AmbientHorizontalLane, polygon: readonly AmbientHousePoint[]): LaneInterval[] {
  const lane = normalizeAmbientHorizontalLane(laneSource);
  const xs = [lane.x1, lane.x2];

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[previousIndex];
    const b = polygon[index];
    if (Math.abs(a.y - b.y) < 0.001) continue;
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (lane.y < minY || lane.y > maxY) continue;
    const t = (lane.y - a.y) / (b.y - a.y);
    if (t < 0 || t > 1) continue;
    const x = a.x + (b.x - a.x) * t;
    if (x >= lane.x1 && x <= lane.x2) xs.push(x);
  }

  const ordered = Array.from(new Set(xs.map((x) => Math.round(x * 10) / 10))).sort((a, b) => a - b);
  const intervals: LaneInterval[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const x1 = ordered[index];
    const x2 = ordered[index + 1];
    if (x2 - x1 < 2) continue;
    const midpoint = { x: (x1 + x2) / 2, y: lane.y };
    if (!pointInPolygon(midpoint, polygon)) continue;
    intervals.push({ laneId: lane.id, y: lane.y, x1, x2, midLayer: lane.midLayer });
  }
  return intervals;
}

function buildAreaIntervals(areaId: AreaId) {
  const polygon = areaBoundary(areaId).points;
  return GRAPH.horizontalLanes.flatMap((lane) => laneIntervalsInsidePolygon(lane, polygon));
}

function intervalContaining(intervals: readonly LaneInterval[], laneId: string, x: number) {
  return intervals.find((interval) => interval.laneId === laneId && x >= interval.x1 - 1 && x <= interval.x2 + 1);
}

function randomPointInInterval(interval: LaneInterval): AmbientHousePoint {
  const margin = Math.min(18, Math.max(0, (interval.x2 - interval.x1) * 0.1));
  const x1 = interval.x1 + margin;
  const x2 = interval.x2 - margin;
  return {
    x: x2 > x1 ? x1 + Math.random() * (x2 - x1) : (interval.x1 + interval.x2) / 2,
    y: interval.y,
  };
}

function nearestGraphPoint(reference: AmbientHousePoint) {
  let best: { point: AmbientHousePoint; laneId: string; distance: number } | null = null;
  for (const source of GRAPH.horizontalLanes) {
    const lane = normalizeAmbientHorizontalLane(source);
    const point = { x: clamp(reference.x, lane.x1, lane.x2), y: lane.y };
    const distance = Math.hypot(reference.x - point.x, reference.y - point.y);
    if (!best || distance < best.distance) best = { point, laneId: lane.id, distance };
  }
  return best;
}

function routeToTarget(start: { point: AmbientHousePoint; laneId: string }, target: { point: AmbientHousePoint; laneId: string }) {
  type Node = { key: string; point: AmbientHousePoint; laneId: string };
  type Edge = { to: string; weight: number; route: RouteEdge };
  const nodes = new Map<string, Node>();
  const laneNodes = new Map<string, Node[]>();
  const adjacency = new Map<string, Edge[]>();

  const addNode = (laneId: string, point: AmbientHousePoint, suffix = "") => {
    const key = `${laneId}:${point.x.toFixed(1)}:${point.y.toFixed(1)}${suffix}`;
    if (!nodes.has(key)) {
      const node = { key, point: { ...point }, laneId };
      nodes.set(key, node);
      laneNodes.set(laneId, [...(laneNodes.get(laneId) ?? []), node]);
    }
    return key;
  };

  const startKey = addNode(start.laneId, start.point, ":start");
  const targetKey = addNode(target.laneId, target.point, ":target");

  for (const connector of GRAPH.connectors) {
    addNode(connector.from.laneId, connector.from);
    addNode(connector.to.laneId, connector.to);
  }

  const addEdge = (fromKey: string, toKey: string, route: RouteEdge) => {
    const weight = Math.hypot(route.to.x - route.from.x, route.to.y - route.from.y);
    adjacency.set(fromKey, [...(adjacency.get(fromKey) ?? []), { to: toKey, weight, route }]);
  };

  for (const [laneId, entries] of laneNodes) {
    const ordered = [...entries].sort((a, b) => a.point.x - b.point.x);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const a = ordered[index];
      const b = ordered[index + 1];
      addEdge(a.key, b.key, { from: a.point, to: b.point, fromLaneId: laneId, toLaneId: laneId, kind: "lane" });
      addEdge(b.key, a.key, { from: b.point, to: a.point, fromLaneId: laneId, toLaneId: laneId, kind: "lane" });
    }
  }

  for (const connector of GRAPH.connectors) {
    const fromKey = addNode(connector.from.laneId, connector.from);
    const toKey = addNode(connector.to.laneId, connector.to);
    addEdge(fromKey, toKey, { from: connector.from, to: connector.to, fromLaneId: connector.from.laneId, toLaneId: connector.to.laneId, kind: "connector" });
    addEdge(toKey, fromKey, { from: connector.to, to: connector.from, fromLaneId: connector.to.laneId, toLaneId: connector.from.laneId, kind: "connector" });
  }

  const distance = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, { key: string; route: RouteEdge }>();
  const unvisited = new Set(nodes.keys());

  while (unvisited.size) {
    let currentKey: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const key of unvisited) {
      const value = distance.get(key) ?? Number.POSITIVE_INFINITY;
      if (value < currentDistance) {
        currentDistance = value;
        currentKey = key;
      }
    }
    if (!currentKey || !Number.isFinite(currentDistance)) break;
    if (currentKey === targetKey) break;
    unvisited.delete(currentKey);
    for (const edge of adjacency.get(currentKey) ?? []) {
      if (!unvisited.has(edge.to)) continue;
      const candidate = currentDistance + edge.weight;
      if (candidate >= (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distance.set(edge.to, candidate);
      previous.set(edge.to, { key: currentKey, route: edge.route });
    }
  }

  if (!distance.has(targetKey)) return [] as RouteEdge[];
  const reversed: RouteEdge[] = [];
  let cursor = targetKey;
  while (cursor !== startKey) {
    const item = previous.get(cursor);
    if (!item) return [];
    reversed.push(item.route);
    cursor = item.key;
  }
  return reversed.reverse();
}

function validAreaConnectors(areaId: AreaId, intervals: readonly LaneInterval[]) {
  const polygon = areaBoundary(areaId).points;
  return GRAPH.connectors.filter((connector) => {
    const midpoint = { x: (connector.from.x + connector.to.x) / 2, y: (connector.from.y + connector.to.y) / 2 };
    return pointInPolygon(connector.from, polygon)
      && pointInPolygon(connector.to, polygon)
      && pointInPolygon(midpoint, polygon)
      && Boolean(intervalContaining(intervals, connector.from.laneId, connector.from.x))
      && Boolean(intervalContaining(intervals, connector.to.laneId, connector.to.x));
  });
}

function depthZ(plane: AmbientLaneDepth, position: AmbientHousePoint) {
  const yRank = Math.max(0, Math.round(position.y * 100));
  const xRank = Math.max(0, Math.min(1920, Math.round(position.x)));
  const local = yRank * 4096 + xRank * 2;
  return (plane === "behind" ? Z_BEHIND_BASE : Z_FRONT_BASE) + local;
}

function speedFor(edge: RouteEdge) {
  return edge.kind === "connector" ? 92 : 76;
}

function startMove(edge: RouteEdge, now: number): RuntimeMove {
  const distance = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y);
  return { ...edge, startedAt: now, durationMs: Math.max(220, (distance / speedFor(edge)) * 1000) };
}

function initialAgent(subject: AmbientRuntimeSubject, areaId: AreaId, intervals: readonly LaneInterval[]): AgentState {
  const targetInterval = intervals.length
    ? [...intervals].sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1))[0]
    : undefined;
  const targetPoint = targetInterval ? randomPointInInterval(targetInterval) : ENTRY_REFERENCE;
  const start = nearestGraphPoint(ENTRY_REFERENCE);
  if (!start || !targetInterval) {
    return {
      position: targetPoint,
      laneId: targetInterval?.laneId ?? GRAPH.horizontalLanes[0]?.id ?? "lane-01",
      plane: targetInterval?.midLayer ?? "front",
      phase: "wander",
      route: [],
      routeIndex: 0,
      move: null,
      pauseUntil: performance.now() + 500,
    };
  }

  const route = areaId === "reception"
    ? []
    : routeToTarget(start, { point: targetPoint, laneId: targetInterval.laneId });

  if (!route.length) {
    return {
      position: targetPoint,
      laneId: targetInterval.laneId,
      plane: targetInterval.midLayer,
      phase: "wander",
      route: [],
      routeIndex: 0,
      move: null,
      pauseUntil: performance.now() + 450,
    };
  }

  const startLane = GRAPH.horizontalLanes.find((lane) => lane.id === start.laneId);
  return {
    position: start.point,
    laneId: start.laneId,
    plane: startLane?.midLayer ?? "front",
    phase: "transit",
    route,
    routeIndex: 0,
    move: null,
    pauseUntil: performance.now() + 250,
  };
}

function MiniCharacter({ subject, agent }: { subject: AmbientRuntimeSubject; agent: AgentState }) {
  const topLeft = ambientMiniCharacterTopLeftFromAnchor(agent.position);
  return (
    <div
      data-ambient-runtime-character={subject.id}
      data-ambient-runtime-area={inferArea(subject)}
      data-ambient-runtime-phase={agent.phase}
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: AMBIENT_MINI_CHARACTER.width,
        height: AMBIENT_MINI_CHARACTER.height,
        zIndex: depthZ(agent.plane, agent.position),
        pointerEvents: "none",
      }}
    >
      <div
        data-ambient-mini-character
        data-ambient-mini-body="on"
        style={{ position: "absolute", inset: 0, ["--ambient-mini-name" as string]: JSON.stringify(subject.name) }}
      >
        <PrototypeCharacter size={164} wingMotion="off" />
      </div>
    </div>
  );
}

export function AmbientHouseRuntime({ subject }: { subject: AmbientRuntimeSubject }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [scale, setScale] = useState(1);
  const areaId = useMemo(() => inferArea(subject), [subject.path, subject.room]);
  const intervals = useMemo(() => buildAreaIntervals(areaId), [areaId]);
  const areaConnectors = useMemo(() => validAreaConnectors(areaId, intervals), [areaId, intervals]);
  const [agent, setAgent] = useState<AgentState>(() => initialAgent(subject, areaId, intervals));

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      const next = Math.min(rect.width / AMBIENT_HOUSE_CANVAS.width, rect.height / AMBIENT_HOUSE_CANVAS.height);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setAgent(initialAgent(subject, areaId, intervals));
  }, [subject.id, areaId, intervals]);

  useEffect(() => {
    const laneById = new Map(GRAPH.horizontalLanes.map((lane) => [lane.id, normalizeAmbientHorizontalLane(lane)]));

    const tick = (now: number) => {
      setAgent((current) => {
        if (current.move) {
          const move = current.move;
          const progress = Math.min(1, (now - move.startedAt) / Math.max(1, move.durationMs));
          const position = {
            x: move.from.x + (move.to.x - move.from.x) * progress,
            y: move.from.y + (move.to.y - move.from.y) * progress,
          };
          if (progress < 1) return { ...current, position };

          const targetLane = laneById.get(move.toLaneId);
          const arrived: AgentState = {
            ...current,
            position: move.to,
            laneId: move.toLaneId,
            plane: move.kind === "connector" ? (targetLane?.midLayer ?? current.plane) : current.plane,
            move: null,
          };

          if (current.phase === "transit") {
            const nextIndex = current.routeIndex + 1;
            if (nextIndex >= current.route.length) {
              return { ...arrived, phase: "wander", routeIndex: nextIndex, pauseUntil: now + 550 };
            }
            return { ...arrived, routeIndex: nextIndex, pauseUntil: now + 40 };
          }

          return { ...arrived, pauseUntil: now + 500 + Math.random() * 1350 };
        }

        if (now < current.pauseUntil) return current;

        if (current.phase === "transit") {
          const edge = current.route[current.routeIndex];
          if (!edge) return { ...current, phase: "wander", pauseUntil: now + 450 };
          const sourceLane = laneById.get(edge.fromLaneId);
          return {
            ...current,
            plane: sourceLane?.midLayer ?? current.plane,
            move: startMove({ ...edge, from: current.position }, now),
          };
        }

        if (current.pendingConnectorId) {
          const connector = areaConnectors.find((item) => item.id === current.pendingConnectorId);
          if (connector) {
            const fromCurrent = connector.from.laneId === current.laneId;
            const source = fromCurrent ? connector.from : connector.to;
            const target = fromCurrent ? connector.to : connector.from;
            if (Math.hypot(current.position.x - source.x, current.position.y - source.y) < 4) {
              return {
                ...current,
                pendingConnectorId: undefined,
                move: startMove({
                  from: current.position,
                  to: target,
                  fromLaneId: current.laneId,
                  toLaneId: target.laneId,
                  kind: "connector",
                }, now),
              };
            }
          }
        }

        const interval = intervalContaining(intervals, current.laneId, current.position.x)
          ?? intervals.find((item) => item.laneId === current.laneId)
          ?? intervals[0];
        if (!interval) return { ...current, pauseUntil: now + 1200 };

        const attached = areaConnectors.filter((connector) => {
          const endpoint = connector.from.laneId === current.laneId
            ? connector.from
            : connector.to.laneId === current.laneId
              ? connector.to
              : null;
          return Boolean(endpoint && endpoint.x >= interval.x1 - 1 && endpoint.x <= interval.x2 + 1);
        });

        if (attached.length && Math.random() < 0.34) {
          const connector = attached[Math.floor(Math.random() * attached.length)];
          const endpoint = connector.from.laneId === current.laneId ? connector.from : connector.to;
          if (Math.abs(endpoint.x - current.position.x) < 4) {
            const target = connector.from.laneId === current.laneId ? connector.to : connector.from;
            return {
              ...current,
              move: startMove({
                from: current.position,
                to: target,
                fromLaneId: current.laneId,
                toLaneId: target.laneId,
                kind: "connector",
              }, now),
            };
          }
          return {
            ...current,
            pendingConnectorId: connector.id,
            move: startMove({
              from: current.position,
              to: { x: endpoint.x, y: interval.y },
              fromLaneId: current.laneId,
              toLaneId: current.laneId,
              kind: "lane",
            }, now),
          };
        }

        const target = randomPointInInterval(interval);
        const lane = laneById.get(current.laneId);
        return {
          ...current,
          pendingConnectorId: undefined,
          plane: lane?.midLayer ?? current.plane,
          move: startMove({
            from: current.position,
            to: target,
            fromLaneId: current.laneId,
            toLaneId: current.laneId,
            kind: "lane",
          }, now),
        };
      });
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [areaConnectors, intervals]);

  return (
    <div
      ref={viewportRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center", background: "#101711" }}
    >
      <div style={{ position: "relative", width: AMBIENT_HOUSE_CANVAS.width * scale, height: AMBIENT_HOUSE_CANVAS.height * scale, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: AMBIENT_HOUSE_CANVAS.width,
            height: AMBIENT_HOUSE_CANVAS.height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            overflow: "hidden",
            isolation: "isolate",
          }}
        >
          <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 0, pointerEvents: "none" }} />
          {agent.plane === "behind" ? <MiniCharacter subject={subject} agent={agent} /> : null}
          <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: Z_MID, pointerEvents: "none" }} />
          {agent.plane === "front" ? <MiniCharacter subject={subject} agent={agent} /> : null}
          <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: Z_HOUSE_FRONT, pointerEvents: "none" }} />
        </div>
      </div>
    </div>
  );
}
