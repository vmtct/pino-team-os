export type AmbientLaneDepth = "front" | "behind";

export type AmbientLane = {
  id: string;
  y: number;
  x1: number;
  x2: number;
  midLayer: AmbientLaneDepth;
};

export type AmbientMotionGraph = {
  canvas: { width: number; height: number };
  miniCharacter: { width: number; height: number };
  horizontalLanes: AmbientLane[];
};

export type AmbientAgent = {
  id: string;
  laneId: string;
  x: number;
  y: number;
  direction: -1 | 1;
  speed: number;
  depth: AmbientLaneDepth;
};

const MIN_LANE_PX = 220;
const MIN_GAP_PX = 72;
const EDGE_GAP_PX = MIN_GAP_PX / 2;
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

function usableLanes(graph: AmbientMotionGraph) {
  return graph.horizontalLanes
    .map((lane) => ({ ...lane, x1: Math.min(lane.x1, lane.x2), x2: Math.max(lane.x1, lane.x2) }))
    .filter((lane) => lane.x2 - lane.x1 >= MIN_LANE_PX)
    .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
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
      });
    });
  }
  return agents.sort((a, b) => a.id.localeCompare(b.id));
}

export function stepAmbientAgents(
  previous: readonly AmbientAgent[],
  graph: AmbientMotionGraph,
  elapsedMs: number,
): AmbientAgent[] {
  const lanes = new Map(usableLanes(graph).map((lane) => [lane.id, lane]));
  const seconds = Math.min(Math.max(elapsedMs, 0), 80) / 1000;
  const next = previous.map((agent) => {
    const lane = lanes.get(agent.laneId);
    if (!lane) return agent;
    const bounds = motionBounds(lane);
    let direction = agent.direction;
    let x = agent.x + direction * agent.speed * seconds;
    if (x <= bounds.x1) { x = bounds.x1; direction = 1; }
    if (x >= bounds.x2) { x = bounds.x2; direction = -1; }
    return { ...agent, x, direction };
  });

  for (const lane of lanes.values()) {
    const peers = next.filter((agent) => agent.laneId === lane.id).sort((a, b) => a.x - b.x);
    for (let index = 1; index < peers.length; index += 1) {
      const left = peers[index - 1]!;
      const right = peers[index]!;
      const gap = right.x - left.x;
      if (gap >= MIN_GAP_PX) continue;
      const push = (MIN_GAP_PX - gap) / 2;
      const bounds = motionBounds(lane);
      left.x = Math.max(bounds.x1, left.x - push);
      right.x = Math.min(bounds.x2, right.x + push);
      left.direction = -1;
      right.direction = 1;
    }
  }
  return next;
}

export function ambientAgentIsInsideLane(agent: AmbientAgent, graph: AmbientMotionGraph) {
  const lane = usableLanes(graph).find((candidate) => candidate.id === agent.laneId);
  return Boolean(lane && agent.y === lane.y && agent.x >= lane.x1 && agent.x <= lane.x2);
}
