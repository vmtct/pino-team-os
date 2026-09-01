import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ambientMinimumVisibleSeparation,
  createAmbientAgents,
  resolveAmbientConnectors,
  stepAmbientAgents,
  type AmbientAgent,
  type AmbientMotionGraph,
} from "../app/pinoria-tv/ambient-house-motion";

const actual = JSON.parse(
  readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8"),
) as AmbientMotionGraph;
test("connector-02 crossing keeps Euclidean clearance from lane-04 peers", () => {
  const connector = resolveAmbientConnectors(actual).find((item) => item.id === "connector-02")!;
  const source = actual.horizontalLanes.find((lane) => lane.id === connector.fromLaneId)!;
  const crossingLane = actual.horizontalLanes.find((lane) => lane.id === "lane-04")!;
  const base = createAmbientAgents(["connector-probe", "lane-probe"], actual);
  let agents: AmbientAgent[] = [
    { ...base[0]!, id: "connector-probe", laneId: connector.fromLaneId, x: connector.from.x, y: source.y,
      depth: source.midLayer, motionState: "walk", activityRemainingMs: 999_999,
      targetConnectorId: connector.id, connectorId: connector.id, connectorFromLaneId: connector.fromLaneId,
      connectorToLaneId: connector.toLaneId, connectorProgress: 0 },
    { ...base[1]!, id: "lane-probe", laneId: crossingLane.id, x: 324.12, y: crossingLane.y,
      depth: crossingLane.midLayer, motionState: "walk", activityRemainingMs: 999_999,
      targetConnectorId: undefined, connectorId: undefined, connectorFromLaneId: undefined,
      connectorToLaneId: undefined, connectorProgress: undefined, connectorCooldownMs: 999_999 },
  ];
  let crossedLaneBand = false;
  for (let tick = 0; tick < 500; tick += 1) {
    agents = stepAmbientAgents(agents, actual, 40);
    const connectorAgent = agents.find((agent) => agent.id === "connector-probe")!;
    const laneAgent = agents.find((agent) => agent.id === "lane-probe")!;
    if (connectorAgent.connectorId && Math.abs(connectorAgent.y - crossingLane.y) < 72) crossedLaneBand = true;
    if (connectorAgent.connectorId) {
      const distance = Math.hypot(connectorAgent.x - laneAgent.x, connectorAgent.y - laneAgent.y);
      assert.ok(distance >= 71.999, `tick ${tick} connector/lane clearance ${distance}`);
    }
  }
  assert.equal(crossedLaneBand, true, "connector-02 never crossed the lane-04 collision band");
});


test("actual graph keeps forty visible learners at 2D social spacing across overlapping lanes", () => {
  const ids = Array.from({ length: 40 }, (_, index) => `learner-${String(index + 1).padStart(2, "0")}`);
  let agents = createAmbientAgents(ids, actual);
  let sawLane10And11 = false;
  for (let tick = 0; tick < 5000; tick += 1) {
    agents = stepAmbientAgents(agents, actual, 40);
    sawLane10And11 ||= agents.some((agent) => !agent.connectorId && agent.laneId === "lane-10")
      && agents.some((agent) => !agent.connectorId && agent.laneId === "lane-11");
    assert.ok(ambientMinimumVisibleSeparation(agents) >= 71.999, `tick ${tick} visible separation regressed`);
  }
  assert.equal(sawLane10And11, true, "test never exercised simultaneous lane-10/lane-11 occupancy");
});

test("forty-learner departure transition remains collision-safe", () => {
  const ids = Array.from({ length: 40 }, (_, index) => `learner-${String(index + 1).padStart(2, "0")}`);
  let agents = createAmbientAgents(ids, actual);
  const departingAgent = agents.find((agent) => agent.laneId === "lane-04")!;
  const startX = departingAgent.x;
  const departing = new Set([departingAgent.id]);
  for (let tick = 0; tick < 30; tick += 1) {
    agents = stepAmbientAgents(agents, actual, 40, { departingIds: departing });
    assert.ok(ambientMinimumVisibleSeparation(agents) >= 71.999, `departure tick ${tick} visible separation regressed`);
  }
  assert.notEqual(agents.find((agent) => agent.id === departingAgent.id)!.x, startX);
});
