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
const SAFE_CLEARANCE_PX = MIN_GAP_PX + 0.001;
const SAFE_SLOT_STEP_PX = 6;
const SAFE_SLOT_SEED = 1090;

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

function pointToSegmentDistance(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - from.x, point.y - from.y);
  const t = Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

function pointIsClear(point: { x: number; y: number }, agents: readonly AmbientAgent[], agentId: string) {
  return agents.every((other) => other.id === agentId
    || Math.hypot(point.x - other.x, point.y - other.y) >= SAFE_CLEARANCE_PX);
}

function pathIsClear(path: readonly { x: number; y: number }[], agents: readonly AmbientAgent[], agentId: string) {
  for (const other of agents) {
    if (other.id === agentId) continue;
    for (let index = 1; index < path.length; index += 1) {
      if (pointToSegmentDistance({ x: other.x, y: other.y }, path[index - 1]!, path[index]!) < SAFE_CLEARANCE_PX) return false;
    }
  }
  return true;
}

function furthestClearX(currentX: number, proposedX: number, y: number, agents: readonly AmbientAgent[], agentId: string) {
  const path = (x: number) => [{ x: currentX, y }, { x, y }];
  if (currentX === proposedX || pathIsClear(path(proposedX), agents, agentId)) return proposedX;
  let safe = currentX;
  let low = 0;
  let high = 1;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const ratio = (low + high) / 2;
    const x = currentX + (proposedX - currentX) * ratio;
    if (pathIsClear(path(x), agents, agentId)) {
      safe = x;
      low = ratio;
    } else {
      high = ratio;
    }
  }
  return safe;
}

function furthestClearProgress(path: readonly { x: number; y: number }[], current: number, proposed: number, agents: readonly AmbientAgent[], agentId: string) {
  if (current === proposed || pointIsClear(pointOnPath(path, proposed), agents, agentId)) return proposed;
  let safe = current;
  let low = current;
  let high = proposed;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const progress = (low + high) / 2;
    if (pointIsClear(pointOnPath(path, progress), agents, agentId)) { safe = progress; low = progress; }
    else high = progress;
  }
  return safe;
}

function collisionSafeSlots(graph: AmbientMotionGraph) {
  const candidates = usableLanes(graph).flatMap((lane) => {
    const bounds = motionBounds(lane);
    const points: Array<{ lane: AmbientLane; x: number; y: number }> = [];
    for (let x = bounds.x1; x <= bounds.x2 + 0.001; x += SAFE_SLOT_STEP_PX) {
      points.push({ lane, x: Math.round(x * 1000) / 1000, y: lane.y });
    }
    return points;
  });
  candidates.sort((a, b) =>
    hash(`${SAFE_SLOT_SEED}:${a.lane.id}:${a.x}`) - hash(`${SAFE_SLOT_SEED}:${b.lane.id}:${b.x}`)
    || a.y - b.y || a.x - b.x || a.lane.id.localeCompare(b.lane.id));
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.every((slot) => Math.hypot(candidate.x - slot.x, candidate.y - slot.y) >= SAFE_CLEARANCE_PX)) {
      selected.push(candidate);
    }
  }
  return selected;
}

function connectorPathCanReserve(target: DirectedConnector, agents: readonly AmbientAgent[], agentId: string) {
  return pathIsClear(target.path, agents, agentId);
}

function chooseClearConnector(agent: AmbientAgent, connectors: readonly DirectedConnector[], agents: readonly AmbientAgent[]) {
  const options = connectors.filter((connector) => connector.fromLaneId === agent.laneId && connectorPathCanReserve(connector, agents, agent.id));
  if (!options.length) return undefined;
  const index = hash(`${agent.id}:${agent.laneId}:${agent.activityEpoch}:clear-connector`) % options.length;
  return options[index];
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
  const slots = collisionSafeSlots(graph);
  const orderedIds = [...ids].sort();
  const lanes = usableLanes(graph);
  return orderedIds.map((id, index) => {
    const fallbackLane = lanes[index % Math.max(lanes.length, 1)];
    const fallbackBounds = fallbackLane ? motionBounds(fallbackLane) : null;
    const slot = slots[index] ?? (fallbackLane && fallbackBounds
      ? { lane: fallbackLane, x: fallbackBounds.x1 + (hash(`${id}:overflow`) % 1000) / 1000 * (fallbackBounds.x2 - fallbackBounds.x1), y: fallbackLane.y }
      : null);
    if (!slot) throw new Error("AMBIENT_HOUSE_GRAPH_EMPTY");
    const seed = hash(`${id}:motion`);
    return {
      id,
      laneId: slot.lane.id,
      x: slot.x,
      y: slot.y,
      direction: seed % 2 === 0 ? 1 : -1,
      speed: 18 + (seed % 15),
      depth: slot.lane.midLayer,
      motionState: "walk" as const,
      activityEpoch: 0,
      activityRemainingMs: activityDurationMs(id, "walk", 0),
    };
  });
}

export function stepAmbientAgents(
  previous: readonly AmbientAgent[],
  graph: AmbientMotionGraph,
  elapsedMs: number,
  options: { departingIds?: ReadonlySet<string>; frozenIds?: ReadonlySet<string> } = {},
): AmbientAgent[] {
  const laneList = usableLanes(graph);
  const lanes = new Map(laneList.map((lane) => [lane.id, lane]));
  const connectors = directedConnectors(graph);
  const elapsed = Math.min(Math.max(elapsedMs, 0), 80);
  const seconds = elapsed / 1000;
  const reservations = new Map(laneList.map((lane) => [lane.id, 0]));
  const endpointReservations = endpointReservationsForAgents(previous, connectors);
  const activeConnectorAgent = previous.find((agent) => Boolean(agent.connectorId));
  let connectorTraversalClaimed = Boolean(activeConnectorAgent);

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
    if (options.frozenIds?.has(agent.id)) return { ...agent, motionState: "idle" as const };
    let motionState = departing || agent.connectorId ? "walk" as const : agent.motionState;
    let activityEpoch = agent.activityEpoch;
    let activityRemainingMs = departing ? Math.max(agent.activityRemainingMs, 250) : agent.activityRemainingMs - elapsed;
    if (!departing && !agent.connectorId && activityRemainingMs <= 0) {
      activityEpoch += 1;
      motionState = motionState === "walk" ? "idle" : "walk";
      activityRemainingMs += activityDurationMs(agent.id, motionState, activityEpoch);
    }
    const connectorCooldownMs = Math.max(0, (agent.connectorCooldownMs ?? 0) - elapsed);
    const activity = { motionState, activityEpoch, activityRemainingMs, connectorCooldownMs };

    if (agent.connectorId) {
      const connector = connectorForAgent(agent, connectors);
      if (!connector) return { ...agent, ...activity, connectorId: undefined, connectorFromLaneId: undefined, connectorToLaneId: undefined, connectorProgress: undefined };
      const speed = departing ? DEPARTURE_SPEED_PX_PER_SECOND : CONNECTOR_SPEED_PX_PER_SECOND;
      const currentProgress = agent.connectorProgress ?? 0;
      const proposedProgress = Math.min(1, currentProgress + (speed * seconds) / connector.length);
      const progress = furthestClearProgress(connector.path, currentProgress, proposedProgress, previous, agent.id);
      const destination = lanes.get(connector.toLaneId)!;
      const source = lanes.get(connector.fromLaneId)!;
      const point = pointOnPath(connector.path, progress);
      if (progress < 1) return { ...agent, ...activity, x: point.x, y: point.y, connectorProgress: progress, depth: progress < 0.5 ? source.midLayer : destination.midLayer };
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
      const proposed = direction < 0
        ? Math.max(targetX, agent.x - DEPARTURE_SPEED_PX_PER_SECOND * seconds)
        : Math.min(targetX, agent.x + DEPARTURE_SPEED_PX_PER_SECOND * seconds);
      const x = furthestClearX(agent.x, proposed, lane.y, previous, agent.id);
      return { ...agent, ...activity, x, direction, targetConnectorId: undefined };
    }

    let target = agent.targetConnectorId
      ? connectors.find((connector) => connector.id === agent.targetConnectorId && connector.fromLaneId === agent.laneId)
      : undefined;
    if (!target && connectorCooldownMs <= 0) target = chooseClearConnector({ ...agent, activityEpoch }, connectors, previous) ?? chooseConnector({ ...agent, activityEpoch }, connectors);

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
          && connectorPathCanReserve(target, previous, agent.id);
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
      const proposed = direction < 0 ? Math.max(target.from.x, agent.x - distance) : Math.min(target.from.x, agent.x + distance);
      const x = furthestClearX(agent.x, proposed, lane.y, previous, agent.id);
      return { ...agent, ...activity, x, direction, targetConnectorId: target.id };
    }

    let direction = agent.direction;
    let proposed = agent.x + direction * agent.speed * seconds;
    if (proposed <= bounds.x1) { proposed = bounds.x1; direction = 1; }
    if (proposed >= bounds.x2) { proposed = bounds.x2; direction = -1; }
    const x = furthestClearX(agent.x, proposed, lane.y, previous, agent.id);
    return { ...agent, ...activity, x, direction };
  });

  // Every proposal is checked against the previous collision-free frame. Two peers
  // can still propose points toward each other in the same tick, so deterministically
  // roll back the later proposal. A previous-frame point is safe against every other
  // accepted proposal because each proposal was checked against all previous points.
  for (let left = 0; left < next.length; left += 1) {
    for (let right = left + 1; right < next.length; right += 1) {
      if (Math.hypot(next[left]!.x - next[right]!.x, next[left]!.y - next[right]!.y) >= SAFE_CLEARANCE_PX) continue;
      const before = previous[right]!;
      next[right] = {
        ...next[right]!,
        laneId: before.laneId,
        x: before.x,
        y: before.y,
        direction: before.direction,
        depth: before.depth,
        targetConnectorId: before.targetConnectorId,
        connectorId: before.connectorId,
        connectorFromLaneId: before.connectorFromLaneId,
        connectorToLaneId: before.connectorToLaneId,
        connectorProgress: before.connectorProgress,
      };
    }
  }
  for (const agent of next) {
    if (!agent.connectorId) agent.x = Math.round(agent.x * 1_000_000) / 1_000_000;
  }
  return next;
}

export function ambientMinimumVisibleSeparation(agents: readonly AmbientAgent[]) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < agents.length; left += 1) {
    for (let right = left + 1; right < agents.length; right += 1) {
      minimum = Math.min(minimum, Math.hypot(agents[left]!.x - agents[right]!.x, agents[left]!.y - agents[right]!.y));
    }
  }
  return minimum;
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
