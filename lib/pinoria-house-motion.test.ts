import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ambientAgentIsInsideGraph,
  ambientAgentIsInsideLane,
  ambientLaneReservationPoints,
  createAmbientAgents,
  resolveAmbientConnectors,
  stepAmbientAgents,
  type AmbientAgent,
  type AmbientMotionGraph,
} from "../app/pinoria-tv/ambient-house-motion";

const graph: AmbientMotionGraph = {
  canvas: { width: 1920, height: 1080 },
  miniCharacter: { width: 164, height: 115 },
  horizontalLanes: Array.from({ length: 5 }, (_, index) => ({
    id: `lane-${index + 1}`,
    y: 520 + index * 90,
    x1: 120,
    x2: 1800,
    midLayer: index < 2 ? "behind" as const : "front" as const,
  })),
  rawConnectors: [
    { id: "connector-1-2", from: { x: 500, y: 520 }, to: { x: 700, y: 610 } },
    { id: "connector-2-3", from: { x: 1200, y: 610 }, to: { x: 1050, y: 700 } },
  ],
};

const ids = Array.from({ length: 40 }, (_, index) => `learner-${String(index + 1).padStart(2, "0")}`);

function assertLaneReservations(agents: ReturnType<typeof createAmbientAgents>, currentGraph: AmbientMotionGraph, label: string) {
  for (const lane of currentGraph.horizontalLanes) {
    const points = ambientLaneReservationPoints(agents, currentGraph, lane.id);
    for (let index = 1; index < points.length; index += 1) {
      const gap = points[index]!.x - points[index - 1]!.x;
      assert.ok(gap >= 71.999, `${label} ${lane.id} reservation gap ${gap}`);
    }
  }
  const activeConnectorIds = agents.filter((agent) => agent.connectorId).map((agent) => agent.connectorId!);
  assert.equal(new Set(activeConnectorIds).size, activeConnectorIds.length, `${label} reuses an active connector`);
}

test("ambient placement is deterministic for forty learners", () => {
  const first = createAmbientAgents(ids, graph);
  const second = createAmbientAgents(ids, graph);
  assert.equal(first.length, 40);
  assert.deepEqual(first, second);
  assert.ok(first.every((agent) => ambientAgentIsInsideLane(agent, graph)));
});

test("ambient learners alternate deterministic walk and idle states", () => {
  let agents = createAmbientAgents(ids, graph);
  const seen = new Map(agents.map((agent) => [agent.id, new Set([agent.motionState])]));
  for (let tick = 0; tick < 400; tick += 1) {
    agents = stepAmbientAgents(agents, graph, 40);
    for (const agent of agents) seen.get(agent.id)!.add(agent.motionState);
  }
  assert.ok([...seen.values()].every((states) => states.has("walk") && states.has("idle")));
});

test("ambient movement stays inside the governed graph and preserves lane spacing", () => {
  let agents = createAmbientAgents(ids, graph);
  for (let tick = 0; tick < 1200; tick += 1) agents = stepAmbientAgents(agents, graph, 40);
  assert.ok(agents.every((agent) => ambientAgentIsInsideGraph(agent, graph)));
  for (const lane of graph.horizontalLanes) {
    const peers = agents.filter((agent) => !agent.connectorId && agent.laneId === lane.id).sort((a, b) => a.x - b.x);
    for (let index = 1; index < peers.length; index += 1) {
      const gap = peers[index]!.x - peers[index - 1]!.x;
      assert.ok(gap >= 71.999, `lane ${lane.id} gap ${gap}`);
    }
  }
});

test("every saved raw connector resolves without dropping short lanes or raw geometry", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  const connectors = resolveAmbientConnectors(actual);
  assert.equal(connectors.length, actual.rawConnectors?.length, "every saved connector must resolve");
  const byId = new Map(connectors.map((connector) => [connector.id, connector]));
  for (const raw of actual.rawConnectors ?? []) {
    const connector = byId.get(raw.id);
    assert.ok(connector, `missing ${raw.id}`);
    assert.ok(connector!.path.some((point) => point.x === raw.from.x && point.y === raw.from.y), `${raw.id} drops raw from geometry`);
    assert.ok(connector!.path.some((point) => point.x === raw.to.x && point.y === raw.to.y), `${raw.id} drops raw to geometry`);
    const rawLength = Math.hypot(raw.to.x - raw.from.x, raw.to.y - raw.from.y);
    let resolvedLength = 0;
    for (let index = 1; index < connector!.path.length; index += 1) {
      resolvedLength += Math.hypot(connector!.path[index]!.x - connector!.path[index - 1]!.x, connector!.path[index]!.y - connector!.path[index - 1]!.y);
    }
    assert.ok(resolvedLength >= rawLength - 0.01, `${raw.id} collapsed raw connector geometry`);
  }
  assert.equal(byId.get("connector-07")?.toLaneId, "lane-08");
  assert.equal(byId.get("connector-08")?.fromLaneId, "lane-09");
});

test("every saved House connector is traversable and changes lane", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  for (const connector of resolveAmbientConnectors(actual)) {
    const lane = actual.horizontalLanes.find((candidate) => candidate.id === connector.fromLaneId)!;
    let agent: AmbientAgent = {
      ...createAmbientAgents([`probe-${connector.id}`], actual)[0]!,
      laneId: connector.fromLaneId,
      x: connector.from.x,
      y: lane.y,
      depth: lane.midLayer,
      motionState: "walk" as const,
      activityRemainingMs: 999_999,
      targetConnectorId: connector.id,
      connectorCooldownMs: 0,
    };
    let sawConnector = false;
    for (let tick = 0; tick < 5000 && agent.laneId === connector.fromLaneId; tick += 1) {
      [agent] = stepAmbientAgents([agent], actual, 40);
      sawConnector ||= agent.connectorId === connector.id;
      assert.ok(ambientAgentIsInsideGraph(agent, actual), `${connector.id} left graph`);
    }
    assert.equal(sawConnector, true, `${connector.id} was never entered`);
    assert.equal(agent.laneId, connector.toLaneId, `${connector.id} did not change lane`);
  }
});

test("actual House graph preserves forty-learner reservations on every traversal tick", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  let agents = createAmbientAgents(ids, actual);
  let sawTraversal = false;
  for (let tick = 0; tick < 2400; tick += 1) {
    agents = stepAmbientAgents(agents, actual, 40);
    sawTraversal ||= agents.some((agent) => Boolean(agent.connectorId));
    assert.ok(agents.every((agent) => ambientAgentIsInsideGraph(agent, actual)), `tick ${tick} left graph`);
    assertLaneReservations(agents, actual, `tick ${tick}`);
  }
  assert.equal(sawTraversal, true, "forty-learner run never exercised connector traversal");
});

test("departure transition moves the learner toward a lane exit while staying bounded", () => {
  let agent = createAmbientAgents(["departing-learner"], graph)[0]!;
  const startX = agent.x;
  const departing = new Set([agent.id]);
  for (let tick = 0; tick < 20; tick += 1) [agent] = stepAmbientAgents([agent], graph, 40, { departingIds: departing });
  assert.notEqual(agent.x, startX);
  assert.equal(agent.motionState, "walk");
  assert.ok(ambientAgentIsInsideGraph(agent, graph));
});
