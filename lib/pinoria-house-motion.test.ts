import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ambientAgentIsInsideLane,
  createAmbientAgents,
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
test("ambient movement stays on governed lanes", () => {
  let agents = createAmbientAgents(ids, graph);
  for (let tick = 0; tick < 400; tick += 1) {
    agents = stepAmbientAgents(agents, graph, 40);
  }
  assert.ok(agents.every((agent) => ambientAgentIsInsideLane(agent, graph)));
  for (const lane of graph.horizontalLanes) {
    const peers = agents.filter((agent) => agent.laneId === lane.id).sort((a, b) => a.x - b.x);
    for (let index = 1; index < peers.length; index += 1) {
      const gap = peers[index]!.x - peers[index - 1]!.x;
      assert.ok(gap >= 71.9, `lane ${lane.id} gap ${gap}`);
    }
  }
});

test("actual House graph keeps forty learners above minimum spacing", () => {
  const actual = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as AmbientMotionGraph;
  let agents = createAmbientAgents(ids, actual);
  for (let tick = 0; tick < 400; tick += 1) agents = stepAmbientAgents(agents, actual, 40);
  for (const lane of actual.horizontalLanes) {
    const peers = agents.filter((agent) => agent.laneId === lane.id).sort((a, b) => a.x - b.x);
    for (let index = 1; index < peers.length; index += 1) {
      assert.ok(peers[index]!.x - peers[index - 1]!.x >= 71.9, `actual lane ${lane.id} stacks learners`);
    }
  }
});
