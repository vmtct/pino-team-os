export type AmbientLaneDepth = "front" | "behind";

export type AmbientLane = {
  id: string;
  y: number;
  x1: number;
  x2: number;
  midLayer: AmbientLaneDepth;
};

export type AmbientRawConnector = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export type AmbientMotionGraph = {
  canvas: { width: number; height: number };
  miniCharacter: { width: number; height: number };
  horizontalLanes: AmbientLane[];
  rawConnectors?: AmbientRawConnector[];
};

export type AmbientResolvedConnector = {
  id: string;
  fromLaneId: string;
  toLaneId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  path: { x: number; y: number }[];
};

export type AmbientAgent = {
  id: string;
  laneId: string;
  x: number;
  y: number;
  direction: -1 | 1;
  speed: number;
  depth: AmbientLaneDepth;
  motionState: "walk" | "idle";
  activityEpoch: number;
  activityRemainingMs: number;
  targetConnectorId?: string;
  connectorId?: string;
  connectorFromLaneId?: string;
  connectorToLaneId?: string;
  connectorProgress?: number;
  connectorCooldownMs?: number;
};

const MIN_GAP_PX = 72;
const MIN_TRAVERSABLE_LANE_PX = MIN_GAP_PX;
const EDGE_GAP_PX = MIN_GAP_PX / 2;
const CONNECTOR_SNAP_PX = 120;
const CONNECTOR_SPEED_PX_PER_SECOND = 132;
const CONNECTOR_COOLDOWN_MS = 1800;
const DEPARTURE_SPEED_PX_PER_SECOND = 700;

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function motionBounds(lane: AmbientLane) {
  return { x1: lane.x1 + EDGE_GAP_PX, x2: lane.x2 - EDGE_GAP_PX };
}

function laneCapacity(lane: AmbientLane) {
  const bounds = motionBounds(lane);
  return Math.max(1, Math.floor((bounds.x2 - bounds.x1) / MIN_GAP_PX) + 1);
}

function activityDurationMs(id: string, state: "walk" | "idle", epoch: number) {
  const seed = hash(`${id}:${state}:${epoch}`);
  return state === "walk" ? 1200 + (seed % 2800) : 600 + (seed % 800);
}

function usableLanes(graph: AmbientMotionGraph) {
  return graph.horizontalLanes
    .map((lane) => ({ ...lane, x1: Math.min(lane.x1, lane.x2), x2: Math.max(lane.x1, lane.x2) }))
    .filter((lane) => lane.x2 - lane.x1 >= MIN_TRAVERSABLE_LANE_PX)
    .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
}

function distanceToLane(point: { x: number; y: number }, lane: AmbientLane) {
  const dx = point.x < lane.x1 ? lane.x1 - point.x : point.x > lane.x2 ? point.x - lane.x2 : 0;
  return Math.hypot(dx, point.y - lane.y);
}

function snapToLane(point: { x: number; y: number }, lane: AmbientLane) {
  const bounds = motionBounds(lane);
  return { x: Math.min(Math.max(point.x, bounds.x1), bounds.x2), y: lane.y };
}

export function resolveAmbientConnectors(graph: AmbientMotionGraph): AmbientResolvedConnector[] {
  const lanes = usableLanes(graph);
  const resolved: AmbientResolvedConnector[] = [];
  for (const connector of graph.rawConnectors ?? []) {
    const nearest = (point: { x: number; y: number }) => lanes
      .map((lane) => ({ lane, distance: distanceToLane(point, lane) }))
      .sort((a, b) => a.distance - b.distance || a.lane.id.localeCompare(b.lane.id))[0];
    const from = nearest(connector.from);
    const to = nearest(connector.to);
    if (!from || !to || from.distance > CONNECTOR_SNAP_PX || to.distance > CONNECTOR_SNAP_PX) continue;
    if (from.lane.id === to.lane.id) continue;
    const fromAnchor = snapToLane(connector.from, from.lane);
    const toAnchor = snapToLane(connector.to, to.lane);
    const path = [fromAnchor, connector.from, connector.to, toAnchor].filter((point, index, points) =>
      index === 0 || Math.hypot(point.x - points[index - 1]!.x, point.y - points[index - 1]!.y) > 0.01);
    resolved.push({
      id: connector.id,
      fromLaneId: from.lane.id,
      toLaneId: to.lane.id,
      from: fromAnchor,
      to: toAnchor,
      path,
    });
  }
  return resolved;
}

type DirectedConnector = AmbientResolvedConnector & { length: number };

function pathLength(path: readonly { x: number; y: number }[]) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += Math.hypot(path[index]!.x - path[index - 1]!.x, path[index]!.y - path[index - 1]!.y);
  }
  return total;
}

function pointOnPath(path: readonly { x: number; y: number }[], progress: number) {
  const total = Math.max(pathLength(path), 0.001);
  let remaining = Math.min(Math.max(progress, 0), 1) * total;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    if (remaining <= segment || index === path.length - 1) {
      const ratio = segment <= 0.001 ? 1 : Math.min(remaining / segment, 1);
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    remaining -= segment;
  }
  return path.at(-1)!;
}

function directedConnectors(graph: AmbientMotionGraph): DirectedConnector[] {
  return resolveAmbientConnectors(graph).flatMap((connector) => {
    const length = Math.max(1, pathLength(connector.path));
    return [
      { ...connector, length },
      {
        id: connector.id,
        fromLaneId: connector.toLaneId,
        toLaneId: connector.fromLaneId,
        from: connector.to,
        to: connector.from,
        path: [...connector.path].reverse(),
        length,
      },
    ];
  });
}

function connectorForAgent(agent: AmbientAgent, connectors: readonly DirectedConnector[]) {
  return connectors.find((connector) => connector.id === agent.connectorId
    && connector.fromLaneId === agent.connectorFromLaneId
    && connector.toLaneId === agent.connectorToLaneId);
}

function chooseConnector(agent: AmbientAgent, connectors: readonly DirectedConnector[]) {
  const options = connectors.filter((connector) => connector.fromLaneId === agent.laneId);
  if (!options.length) return undefined;
  const index = hash(`${agent.id}:${agent.laneId}:${agent.activityEpoch}:connector`) % options.length;
  return options[index];
}

type ConnectorEndpointReservation = { agentId: string; laneId: string; x: number };

function endpointReservationsForAgents(agents: readonly AmbientAgent[], connectors: readonly DirectedConnector[]) {
  const reservations: ConnectorEndpointReservation[] = [];
  for (const agent of agents) {
    if (!agent.connectorId) continue;
    const connector = connectorForAgent(agent, connectors);
    if (!connector) continue;
    reservations.push({ agentId: agent.id, laneId: connector.fromLaneId, x: connector.from.x });
    reservations.push({ agentId: agent.id, laneId: connector.toLaneId, x: connector.to.x });
  }
  return reservations;
}

function laneSlotsAroundBlockers(lane: AmbientLane, blockerXs: readonly number[]) {
  const bounds = motionBounds(lane);
  const blockers = [...new Set(blockerXs)].sort((a, b) => a - b);
  for (let index = 1; index < blockers.length; index += 1) {
    if (blockers[index]! - blockers[index - 1]! < MIN_GAP_PX - 0.001) return [];
  }
  const slots: number[] = [];
  const addInterval = (start: number, end: number) => {
    for (let x = start; x <= end + 0.001; x += MIN_GAP_PX) slots.push(Math.round(x * 1000) / 1000);
  };
  let start = bounds.x1;
  for (const blocker of blockers) {
    addInterval(start, blocker - MIN_GAP_PX);
    start = blocker + MIN_GAP_PX;
  }
  addInterval(start, bounds.x2);
  return slots;
}

type LaneExclusion = { x1: number; x2: number };

function mergeLaneExclusions(lane: AmbientLane, exclusions: readonly LaneExclusion[]) {
  const bounds = motionBounds(lane);
  const normalized = exclusions
    .map((item) => ({ x1: Math.max(bounds.x1, Math.min(item.x1, item.x2)), x2: Math.min(bounds.x2, Math.max(item.x1, item.x2)) }))
    .filter((item) => item.x1 <= item.x2)
    .sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2);
  const merged: LaneExclusion[] = [];
  for (const item of normalized) {
    const previous = merged.at(-1);
    if (!previous || item.x1 > previous.x2 + 0.001) merged.push({ ...item });
    else previous.x2 = Math.max(previous.x2, item.x2);
  }
  return merged;
}

function laneSlotsAroundExclusions(lane: AmbientLane, exclusions: readonly LaneExclusion[]) {
  const bounds = motionBounds(lane);
  const merged = mergeLaneExclusions(lane, exclusions);
  const slots: number[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  const addSafeInterval = (start: number, end: number) => {
    if (end < start) return;
    let x = Number.isFinite(previous) ? Math.max(start, previous + MIN_GAP_PX) : start;
    while (x <= end + 0.001) {
      const rounded = Math.round(x * 1_000_000) / 1_000_000;
      slots.push(rounded);
      previous = rounded;
      x = previous + MIN_GAP_PX;
    }
  };
  let start = bounds.x1;
  for (const exclusion of merged) {
    addSafeInterval(start, exclusion.x1 - 0.001);
    start = exclusion.x2 + 0.001;
  }
  addSafeInterval(start, bounds.x2);
  return slots;
}

function connectorPathLaneExclusions(connector: DirectedConnector, lanes: Iterable<AmbientLane>) {
  const result = new Map<string, LaneExclusion[]>();
  for (const lane of lanes) {
    const exclusions: LaneExclusion[] = [];
    for (let index = 1; index < connector.path.length; index += 1) {
      const from = connector.path[index - 1]!;
      const to = connector.path[index]!;
      const low = lane.y - MIN_GAP_PX;
      const high = lane.y + MIN_GAP_PX;
      const dy = to.y - from.y;
      if (Math.abs(dy) < 0.001) {
        if (from.y < low || from.y > high) continue;
        exclusions.push({ x1: Math.min(from.x, to.x) - MIN_GAP_PX, x2: Math.max(from.x, to.x) + MIN_GAP_PX });
        continue;
      }
      const ta = (low - from.y) / dy;
      const tb = (high - from.y) / dy;
      const start = Math.max(0, Math.min(ta, tb));
      const end = Math.min(1, Math.max(ta, tb));
      if (start > end) continue;
      const x1 = from.x + (to.x - from.x) * start;
      const x2 = from.x + (to.x - from.x) * end;
      exclusions.push({ x1: Math.min(x1, x2) - MIN_GAP_PX, x2: Math.max(x1, x2) + MIN_GAP_PX });
    }
    if (exclusions.length) result.set(lane.id, mergeLaneExclusions(lane, exclusions));
  }
  return result;
}

function activeConnectorLaneExclusions(agents: readonly AmbientAgent[], connectors: readonly DirectedConnector[], lanes: ReadonlyMap<string, AmbientLane>) {
  const result = new Map<string, LaneExclusion[]>();
  for (const agent of agents) {
    if (!agent.connectorId) continue;
    const connector = connectorForAgent(agent, connectors);
    if (!connector) continue;
    const next = connectorPathLaneExclusions(connector, lanes.values());
    for (const [laneId, exclusions] of next) result.set(laneId, [...(result.get(laneId) ?? []), ...exclusions]);
  }
  for (const [laneId, exclusions] of result) {
    const lane = lanes.get(laneId);
    if (lane) result.set(laneId, mergeLaneExclusions(lane, exclusions));
  }
  return result;
}

function connectorPathCanReserve(target: DirectedConnector, agents: readonly AmbientAgent[], lanes: ReadonlyMap<string, AmbientLane>, agentId: string) {
  const exclusions = connectorPathLaneExclusions(target, lanes.values());
  for (const lane of lanes.values()) {
    const peers = agents.filter((other) => other.id !== agentId && !other.connectorId && other.laneId === lane.id);
    const laneExclusions = exclusions.get(lane.id) ?? [];
    if (laneExclusions.length && laneSlotsAroundExclusions(lane, laneExclusions).length < peers.length) return false;
  }
  return true;
}

function connectorEndpointsAreClear(
  target: DirectedConnector,
  agents: readonly AmbientAgent[],
  connectors: readonly DirectedConnector[],
  lanes: ReadonlyMap<string, AmbientLane>,
  endpointReservations: readonly ConnectorEndpointReservation[],
  agentId: string,
) {
  const checks = [
    { laneId: target.fromLaneId, x: target.from.x },
    { laneId: target.toLaneId, x: target.to.x },
  ];
  for (const check of checks) {
    const lane = lanes.get(check.laneId);
    if (!lane) return false;
    const blockers = endpointReservations.filter((reservation) => reservation.agentId !== agentId && reservation.laneId === check.laneId).map((reservation) => reservation.x);
    blockers.push(check.x);
    blockers.sort((a, b) => a - b);
    for (let index = 1; index < blockers.length; index += 1) {
      if (blockers[index]! - blockers[index - 1]! < MIN_GAP_PX - 0.001) return false;
    }
    const movableCount = agents.filter((other) => other.id !== agentId && !other.connectorId && other.laneId === check.laneId).length;
    if (laneSlotsAroundBlockers(lane, blockers).length < movableCount) return false;
  }
  return true;
}

export function createAmbientAgents(ids: readonly string[], graph: AmbientMotionGraph): AmbientAgent[] {
  const lanes = usableLanes(graph);
  if (!lanes.length) return [];
  const grouped = new Map<string, string[]>();
  const remaining = new Map<string, number>();
  for (const lane of lanes) { grouped.set(lane.id, []); remaining.set(lane.id, laneCapacity(lane)); }
  for (const id of [...ids].sort()) {
    const candidates = lanes.filter((lane) => (remaining.get(lane.id) ?? 0) > 0);
    const pool = candidates.length ? candidates : lanes;
    const total = pool.reduce((sum, lane) => sum + Math.max(remaining.get(lane.id) ?? 0, 1), 0);
    let ticket = hash(`${id}:lane`) % total;
    let lane = pool[0]!;
    for (const candidate of pool) { ticket -= Math.max(remaining.get(candidate.id) ?? 0, 1); if (ticket < 0) { lane = candidate; break; } }
    grouped.get(lane.id)!.push(id);
    remaining.set(lane.id, Math.max((remaining.get(lane.id) ?? 0) - 1, 0));
  }
  const agents: AmbientAgent[] = [];
  for (const lane of lanes) {
    const members = grouped.get(lane.id)!;
    members.forEach((id, index) => {
      const bounds = motionBounds(lane);
      const ratio = members.length === 1 ? 0.5 : index / (members.length - 1);
      const seed = hash(`${id}:motion`);
      agents.push({
        id,
        laneId: lane.id,
        x: bounds.x1 + (bounds.x2 - bounds.x1) * ratio,
        y: lane.y,
        direction: seed % 2 === 0 ? 1 : -1,
        speed: 18 + (seed % 15),
        depth: lane.midLayer,
        motionState: "walk",
        activityEpoch: 0,
        activityRemainingMs: activityDurationMs(id, "walk", 0),
      });
    });
  }
  return agents.sort((a, b) => a.id.localeCompare(b.id));
}

export function stepAmbientAgents(
  previous: readonly AmbientAgent[],
  graph: AmbientMotionGraph,
  elapsedMs: number,
  options: { departingIds?: ReadonlySet<string> } = {},
): AmbientAgent[] {
  const laneList = usableLanes(graph);
  const lanes = new Map(laneList.map((lane) => [lane.id, lane]));
  const connectors = directedConnectors(graph);
  const elapsed = Math.min(Math.max(elapsedMs, 0), 80);
  const seconds = elapsed / 1000;
  const reservations = new Map(laneList.map((lane) => [lane.id, 0]));
  const endpointReservations = endpointReservationsForAgents(previous, connectors);
  let connectorTraversalClaimed = previous.some((agent) => Boolean(agent.connectorId));
  for (const agent of previous) {
    if (agent.connectorId) {
      for (const reservedLane of new Set([agent.connectorFromLaneId, agent.connectorToLaneId])) {
        if (reservedLane && reservations.has(reservedLane)) reservations.set(reservedLane, (reservations.get(reservedLane) ?? 0) + 1);
      }
      continue;
    }
    if (reservations.has(agent.laneId)) reservations.set(agent.laneId, (reservations.get(agent.laneId) ?? 0) + 1);
  }

  const next = previous.map((agent) => {
    const departing = options.departingIds?.has(agent.id) ?? false;
    let motionState = departing ? "walk" as const : agent.motionState;
    let activityEpoch = agent.activityEpoch;
    let activityRemainingMs = departing ? Math.max(agent.activityRemainingMs, 250) : agent.activityRemainingMs - elapsed;
    if (!departing && activityRemainingMs <= 0) {
      activityEpoch += 1;
      motionState = motionState === "walk" ? "idle" : "walk";
      activityRemainingMs += activityDurationMs(agent.id, motionState, activityEpoch);
    }
    const connectorCooldownMs = Math.max(0, (agent.connectorCooldownMs ?? 0) - elapsed);
    const activity = { motionState, activityEpoch, activityRemainingMs, connectorCooldownMs };

    if (agent.connectorId) {
      const connector = connectorForAgent(agent, connectors);
      if (!connector) return { ...agent, ...activity, connectorId: undefined, connectorFromLaneId: undefined, connectorToLaneId: undefined, connectorProgress: undefined };
      if (motionState === "idle") return { ...agent, ...activity };
      const speed = departing ? DEPARTURE_SPEED_PX_PER_SECOND : CONNECTOR_SPEED_PX_PER_SECOND;
      const progress = Math.min(1, (agent.connectorProgress ?? 0) + (speed * seconds) / connector.length);
      const destination = lanes.get(connector.toLaneId)!;
      const source = lanes.get(connector.fromLaneId)!;
      const point = pointOnPath(connector.path, progress);
      const x = point.x;
      const y = point.y;
      if (progress < 1) return { ...agent, ...activity, x, y, connectorProgress: progress, depth: progress < 0.5 ? source.midLayer : destination.midLayer };
      return {
        ...agent,
        ...activity,
        laneId: connector.toLaneId,
        x: connector.to.x,
        y: connector.to.y,
        depth: destination.midLayer,
        connectorId: undefined,
        connectorFromLaneId: undefined,
        connectorToLaneId: undefined,
        connectorProgress: undefined,
        targetConnectorId: undefined,
        connectorCooldownMs: CONNECTOR_COOLDOWN_MS,
      };
    }

    const lane = lanes.get(agent.laneId);
    if (!lane || motionState === "idle") return { ...agent, ...activity };
    const bounds = motionBounds(lane);
    if (departing) {
      let targetX = hash(`${agent.id}:departure`) % 2 === 0 ? bounds.x1 : bounds.x2;
      if (Math.abs(targetX - agent.x) < 48) targetX = targetX === bounds.x1 ? bounds.x2 : bounds.x1;
      const direction: -1 | 1 = targetX < agent.x ? -1 : 1;
      const x = direction < 0
        ? Math.max(targetX, agent.x - DEPARTURE_SPEED_PX_PER_SECOND * seconds)
        : Math.min(targetX, agent.x + DEPARTURE_SPEED_PX_PER_SECOND * seconds);
      return { ...agent, ...activity, x, direction, targetConnectorId: undefined };
    }

    let target = agent.targetConnectorId
      ? connectors.find((connector) => connector.id === agent.targetConnectorId && connector.fromLaneId === agent.laneId)
      : undefined;
    if (!target && connectorCooldownMs <= 0) target = chooseConnector({ ...agent, activityEpoch }, connectors);
    if (target) {
      const delta = target.from.x - agent.x;
      const direction: -1 | 1 = delta < 0 ? -1 : 1;
      const distance = agent.speed * seconds;
      if (Math.abs(delta) <= distance + 0.5) {
        const destination = lanes.get(target.toLaneId)!;
        const destinationCount = reservations.get(target.toLaneId) ?? 0;
        const connectorClear = !connectorTraversalClaimed
          && !(options.departingIds?.size)
          && connectorEndpointsAreClear(target, previous, connectors, lanes, endpointReservations, agent.id)
          && connectorPathCanReserve(target, previous, lanes, agent.id);
        if (connectorClear && destinationCount < laneCapacity(destination)) {
          connectorTraversalClaimed = true;
          reservations.set(target.toLaneId, destinationCount + 1);
          endpointReservations.push(
            { agentId: agent.id, laneId: target.fromLaneId, x: target.from.x },
            { agentId: agent.id, laneId: target.toLaneId, x: target.to.x },
          );
          return {
            ...agent,
            ...activity,
            x: target.from.x,
            y: target.from.y,
            direction,
            targetConnectorId: target.id,
            connectorId: target.id,
            connectorFromLaneId: target.fromLaneId,
            connectorToLaneId: target.toLaneId,
            connectorProgress: 0,
          };
        }
      }
      const x = direction < 0 ? Math.max(target.from.x, agent.x - distance) : Math.min(target.from.x, agent.x + distance);
      return { ...agent, ...activity, x, direction, targetConnectorId: target.id };
    }

    let direction = agent.direction;
    let x = agent.x + direction * agent.speed * seconds;
    if (x <= bounds.x1) { x = bounds.x1; direction = 1; }
    if (x >= bounds.x2) { x = bounds.x2; direction = -1; }
    return { ...agent, ...activity, x, direction };
  });

  const connectorExclusions = activeConnectorLaneExclusions(next, connectors, lanes);
  for (const lane of lanes.values()) {
    const laneExclusions = connectorExclusions.get(lane.id) ?? [];
    const peers = next
      .filter((agent) => !agent.connectorId && agent.laneId === lane.id && (!options.departingIds?.has(agent.id) || laneExclusions.length > 0))
      .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    const blockers = endpointReservationsForAgents(next, connectors)
      .filter((reservation) => reservation.laneId === lane.id)
      .map((reservation) => reservation.x);
    const bounds = motionBounds(lane);

    if (laneExclusions.length || blockers.length) {
      const endpointExclusions = blockers.map((x) => ({ x1: x - MIN_GAP_PX, x2: x + MIN_GAP_PX }));
      const slots = laneSlotsAroundExclusions(lane, [...laneExclusions, ...endpointExclusions]);
      if (slots.length >= peers.length) {
        let slotCursor = 0;
        for (let index = 0; index < peers.length; index += 1) {
          const maxSlotIndex = slots.length - (peers.length - index);
          let bestSlotIndex = slotCursor;
          let bestDistance = Number.POSITIVE_INFINITY;
          for (let candidate = slotCursor; candidate <= maxSlotIndex; candidate += 1) {
            const distance = Math.abs(slots[candidate]! - peers[index]!.x);
            if (distance < bestDistance) { bestDistance = distance; bestSlotIndex = candidate; }
          }
          peers[index]!.x = slots[bestSlotIndex]!;
          slotCursor = bestSlotIndex + 1;
        }
        continue;
      }
    }

    for (const peer of peers) peer.x = Math.min(Math.max(peer.x, bounds.x1), bounds.x2);
    for (let index = 1; index < peers.length; index += 1) {
      peers[index]!.x = Math.max(peers[index]!.x, peers[index - 1]!.x + MIN_GAP_PX);
    }
    if (peers.length && peers.at(-1)!.x > bounds.x2) {
      peers.at(-1)!.x = bounds.x2;
      for (let index = peers.length - 2; index >= 0; index -= 1) {
        peers[index]!.x = Math.min(peers[index]!.x, peers[index + 1]!.x - MIN_GAP_PX);
      }
    }
    if (peers.length && peers[0]!.x < bounds.x1) {
      peers[0]!.x = bounds.x1;
      for (let index = 1; index < peers.length; index += 1) {
        peers[index]!.x = Math.max(peers[index]!.x, peers[index - 1]!.x + MIN_GAP_PX);
      }
    }
    for (const peer of peers) peer.x = Math.round(peer.x * 1_000_000) / 1_000_000;
  }
  return next;
}

export function ambientLaneReservationPoints(
  agents: readonly AmbientAgent[],
  graph: AmbientMotionGraph,
  laneId: string,
) {
  const connectors = directedConnectors(graph);
  const points: Array<{ agentId: string; x: number; kind: "lane" | "connector-from" | "connector-to" }> = [];
  for (const agent of agents) {
    if (!agent.connectorId) {
      if (agent.laneId === laneId) points.push({ agentId: agent.id, x: agent.x, kind: "lane" });
      continue;
    }
    const connector = connectorForAgent(agent, connectors);
    if (!connector) continue;
    if (connector.fromLaneId === laneId) points.push({ agentId: agent.id, x: connector.from.x, kind: "connector-from" });
    if (connector.toLaneId === laneId) points.push({ agentId: agent.id, x: connector.to.x, kind: "connector-to" });
  }
  return points.sort((a, b) => a.x - b.x || a.agentId.localeCompare(b.agentId));
}

export function ambientAgentIsInsideLane(agent: AmbientAgent, graph: AmbientMotionGraph) {
  if (agent.connectorId) return false;
  const lane = usableLanes(graph).find((candidate) => candidate.id === agent.laneId);
  return Boolean(lane && agent.y === lane.y && agent.x >= lane.x1 && agent.x <= lane.x2);
}

export function ambientAgentIsInsideGraph(agent: AmbientAgent, graph: AmbientMotionGraph) {
  if (!agent.connectorId) return ambientAgentIsInsideLane(agent, graph);
  const connector = connectorForAgent(agent, directedConnectors(graph));
  const progress = agent.connectorProgress ?? -1;
  if (!connector || progress < 0 || progress > 1) return false;
  const expected = pointOnPath(connector.path, progress);
  const expectedX = expected.x;
  const expectedY = expected.y;
  return Math.abs(agent.x - expectedX) < 0.01 && Math.abs(agent.y - expectedY) < 0.01;
}
