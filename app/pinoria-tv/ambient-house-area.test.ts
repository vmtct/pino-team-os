import assert from "node:assert/strict";
import { test } from "node:test";
import type { PresenceExperience } from "./presence-contract";
import { reconcileAmbientAgents, ambientMinimumVisibleSeparation, type AmbientMotionGraph } from "./ambient-house-motion";
import { resolveAmbientHouseArea } from "./ambient-house-area";

const graph = { horizontalLanes: [{ id: "lane-art", x1: 0, x2: 200, y: 100, midLayer: "front" }, { id: "lane-piano", x1: 0, x2: 200, y: 200, midLayer: "behind" }] } as AmbientMotionGraph;
const areas = [
  { id: "art", laneIds: ["lane-art"], pathCodes: ["ARTCHITECT"] },
  { id: "piano", laneIds: ["lane-piano"], learningSpaceCodes: ["PIANO_HOUSE"] },
];
function context(path: string | null, space: string | null): PresenceExperience {
  return {
    schemaVersion: 1, studentProfileId: "student",
    path: path ? { id: path, code: path, displayName: "label not used" } : null,
    learningSpace: space ? { id: space, code: space, displayName: "label not used" } : null,
    runningClass: null, companion: null, resources: { plsBalance: 0, fruitBalance: 0 },
  };
}
test("PAP-651 canonical path resolves to configured lanes", () => {
  assert.deepEqual(resolveAmbientHouseArea(context("ARTCHITECT", null), graph, areas), { kind: "AREA", areaId: "art", laneIds: ["lane-art"] });
});
test("canonical learningSpace resolves without guessing from display name", () => {
  assert.deepEqual(resolveAmbientHouseArea(context(null, "PIANO_HOUSE"), graph, areas), { kind: "AREA", areaId: "piano", laneIds: ["lane-piano"] });
});
test("missing and unmatched contexts use safe global fallback", () => {
  assert.equal(resolveAmbientHouseArea(null, graph, areas).kind, "GLOBAL");
  assert.deepEqual(resolveAmbientHouseArea(context("UNKNOWN", null), graph, areas), { kind: "GLOBAL", reason: "NO_MATCH" });
});
test("conflicting mappings do not guess an area", () => {
  assert.deepEqual(resolveAmbientHouseArea(context("ARTCHITECT", "PIANO_HOUSE"), graph, areas), { kind: "GLOBAL", reason: "AMBIGUOUS" });
});
test("invalid configured lane does not select an unsafe placement", () => {
  assert.deepEqual(resolveAmbientHouseArea(context("ARTCHITECT", null), graph, [{ id: "art", laneIds: ["absent"], pathCodes: ["ARTCHITECT"] }]), { kind: "GLOBAL", reason: "INVALID_CONFIG" });
});


test("area preference places new actors on approved lane without breaking clearance", () => {
  const preferred = new Map([["learner-1", ["lane-art"]], ["learner-2", ["lane-art"]]]);
  const agents = reconcileAmbientAgents([], ["learner-1", "learner-2"], graph, preferred);
  assert.equal(agents.length, 2);
  assert.ok(agents.every((agent) => agent.laneId === "lane-art"));
  assert.ok(ambientMinimumVisibleSeparation(agents) >= 72);
});
test("full preferred lane safely falls back and reconciliation retains live position", () => {
  const narrowGraph = {
    ...graph, horizontalLanes: [{ ...graph.horizontalLanes[0]!, x1: 0, x2: 80 }, graph.horizontalLanes[1]!],
  };
  const preferred = new Map([["first", ["lane-art"]], ["second", ["lane-art"]]]);
  const agents = reconcileAmbientAgents([], ["first", "second"], narrowGraph, preferred);
  assert.equal(agents.length, 2);
  assert.ok(agents.some((agent) => agent.laneId === "lane-piano"));
  assert.deepEqual(reconcileAmbientAgents(agents, ["first", "second"], narrowGraph, preferred), agents);
});