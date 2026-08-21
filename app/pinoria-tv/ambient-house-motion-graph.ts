import type { AmbientHousePoint } from "./ambient-house-navmesh";

export type AmbientLaneDepth = "front" | "behind";

export type AmbientHorizontalLane = {
  id: string;
  y: number;
  x1: number;
  x2: number;
  midLayer: AmbientLaneDepth;
};

export type AmbientRawConnector = {
  id: string;
  from: AmbientHousePoint;
  to: AmbientHousePoint;
};

export type AmbientCanonicalConnectorEndpoint = AmbientHousePoint & {
  laneId: string;
};

export type AmbientCanonicalConnector = {
  id: string;
  sourceRawId: string;
  from: AmbientCanonicalConnectorEndpoint;
  to: AmbientCanonicalConnectorEndpoint;
};

export type AmbientMotionGraphRaw = {
  canvas: { width: number; height: number };
  miniCharacter: {
    width: number;
    height: number;
    anchor: "center";
    centerOffset: { x: number; y: number };
  };
  horizontalLanes: AmbientHorizontalLane[];
  rawConnectors: AmbientRawConnector[];
};

export type AmbientMotionGraphCanonical = Omit<AmbientMotionGraphRaw, "rawConnectors"> & {
  connectors: AmbientCanonicalConnector[];
  droppedRawConnectorIds: string[];
};

type LaneIntersection = AmbientCanonicalConnectorEndpoint & { t: number };

const EPSILON = 0.001;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function normalizeAmbientHorizontalLane(lane: AmbientHorizontalLane): AmbientHorizontalLane {
  return {
    ...lane,
    y: round1(lane.y),
    x1: round1(Math.min(lane.x1, lane.x2)),
    x2: round1(Math.max(lane.x1, lane.x2)),
  };
}

export function intersectRawConnectorWithLanes(
  connector: AmbientRawConnector,
  lanes: readonly AmbientHorizontalLane[],
): LaneIntersection[] {
  const dx = connector.to.x - connector.from.x;
  const dy = connector.to.y - connector.from.y;
  if (Math.abs(dy) < EPSILON) return [];

  const intersections: LaneIntersection[] = [];
  for (const sourceLane of lanes) {
    const lane = normalizeAmbientHorizontalLane(sourceLane);
    const t = (lane.y - connector.from.y) / dy;
    if (t < -EPSILON || t > 1 + EPSILON) continue;
    const x = connector.from.x + dx * t;
    if (x < lane.x1 - EPSILON || x > lane.x2 + EPSILON) continue;
    intersections.push({
      laneId: lane.id,
      x: round1(Math.min(lane.x2, Math.max(lane.x1, x))),
      y: lane.y,
      t: Math.min(1, Math.max(0, t)),
    });
  }

  intersections.sort((a, b) => a.t - b.t || a.y - b.y || a.x - b.x);

  return intersections.filter((item, index) => {
    if (index === 0) return true;
    const previous = intersections[index - 1];
    return !(
      previous.laneId === item.laneId &&
      Math.abs(previous.t - item.t) < EPSILON &&
      Math.abs(previous.x - item.x) < EPSILON
    );
  });
}

/**
 * Canonical connector rule:
 * - raw diagonal may start/end in empty space;
 * - every horizontal-lane crossing becomes a junction;
 * - orphan prefix/suffix is trimmed;
 * - consecutive lane crossings become one canonical connector segment;
 * - therefore every canonical diagonal endpoint is attached to a horizontal lane.
 */
export function canonicalizeAmbientMotionGraph(raw: AmbientMotionGraphRaw): AmbientMotionGraphCanonical {
  const horizontalLanes = raw.horizontalLanes.map(normalizeAmbientHorizontalLane);
  const connectors: AmbientCanonicalConnector[] = [];
  const droppedRawConnectorIds: string[] = [];

  for (const rawConnector of raw.rawConnectors) {
    const intersections = intersectRawConnectorWithLanes(rawConnector, horizontalLanes);
    let produced = 0;

    for (let index = 0; index < intersections.length - 1; index += 1) {
      const from = intersections[index];
      const to = intersections[index + 1];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (from.laneId === to.laneId || length < 2) continue;

      produced += 1;
      connectors.push({
        id: `${rawConnector.id}:seg-${produced}`,
        sourceRawId: rawConnector.id,
        from: { laneId: from.laneId, x: from.x, y: from.y },
        to: { laneId: to.laneId, x: to.x, y: to.y },
      });
    }

    if (produced === 0) droppedRawConnectorIds.push(rawConnector.id);
  }

  return {
    canvas: { ...raw.canvas },
    miniCharacter: {
      ...raw.miniCharacter,
      centerOffset: { ...raw.miniCharacter.centerOffset },
    },
    horizontalLanes,
    connectors,
    droppedRawConnectorIds,
  };
}

export function pointOnLane(lane: AmbientHorizontalLane, x: number): AmbientHousePoint {
  const normalized = normalizeAmbientHorizontalLane(lane);
  return {
    x: Math.min(normalized.x2, Math.max(normalized.x1, x)),
    y: normalized.y,
  };
}

export function laneLength(lane: AmbientHorizontalLane) {
  const normalized = normalizeAmbientHorizontalLane(lane);
  return normalized.x2 - normalized.x1;
}
