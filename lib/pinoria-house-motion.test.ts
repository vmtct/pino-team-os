import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ambientAgentIsInsideGraph,
  ambientAgentIsInsideLane,
  createAmbientAgents,
  resolveAmbientConnectors,
  stepAmbientAgents,
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
      assert.ok(gap >= 71.9, `lane ${lane.id} gap ${gap}`);
    }
  }
});

test("saved raw connectors resolve into graph edges", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  const connectors = resolveAmbientConnectors(actual);
  assert.ok(connectors.length >= 6, `expected usable graph connectors, got ${connectors.length}`);
  assert.ok(connectors.some((connector) => connector.fromLaneId !== connector.toLaneId));
});

test("actual House graph traverses a connector and changes lane", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  const connectedLaneIds = new Set(resolveAmbientConnectors(actual).flatMap((connector) => [connector.fromLaneId, connector.toLaneId]));
  let agents = createAmbientAgents(Array.from({ length: 80 }, (_, index) => `probe-${index}`), actual);
  const probe = agents.find((agent) => connectedLaneIds.has(agent.laneId));
  assert.ok(probe, "expected a probe on a connected lane");
  agents = [probe!];
  const initialLane = probe!.laneId;
  let sawConnector = false;
  let changedLane = false;
  for (let tick = 0; tick < 5000 && !changedLane; tick += 1) {
    agents = stepAmbientAgents(agents, actual, 40);
    sawConnector ||= Boolean(agents[0]!.connectorId);
    changedLane ||= agents[0]!.laneId !== initialLane;
    assert.ok(ambientAgentIsInsideGraph(agents[0]!, actual));
  }
  assert.equal(sawConnector, true, "agent never entered a saved connector");
  assert.equal(changedLane, true, "agent never changed lane through the graph");
});

test("actual House graph keeps forty learners above minimum spacing", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  let agents = createAmbientAgents(ids, actual);
  for (let tick = 0; tick < 1200; tick += 1) agents = stepAmbientAgents(agents, actual, 40);
  assert.ok(agents.every((agent) => ambientAgentIsInsideGraph(agent, actual)));
  for (const lane of actual.horizontalLanes) {
    const peers = agents.filter((agent) => !agent.connectorId && agent.laneId === lane.id).sort((a, b) => a.x - b.x);
    for (let index = 1; index < peers.length; index += 1) {
      assert.ok(peers[index]!.x - peers[index - 1]!.x >= 71.9, `actual lane ${lane.id} stacks learners`);
    }
  }
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
