import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("representative House lanes preserve behind/front occlusion around MID", () => {
  const graph = JSON.parse(readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-motion-graph.saved.json"), "utf8")) as {
    horizontalLanes: Array<{ id: string; midLayer: "front" | "behind" }>;
  };
  const lane = (id: string) => graph.horizontalLanes.find((item) => item.id === id)?.midLayer;
  assert.equal(lane("lane-06"), "behind");
  assert.equal(lane("lane-01"), "front");

  const runtime = readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-runtime.tsx"), "utf8");
  const behind = runtime.indexOf("{behind.map(renderAgent)}");
  const mid = runtime.indexOf("styles.mid");
  const front = runtime.indexOf("{front.map(renderAgent)}");
  const houseFront = runtime.indexOf("styles.houseFront");
  assert.ok(behind >= 0 && behind < mid);
  assert.ok(mid < front && front < houseFront);
});
