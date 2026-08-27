import type { AmbientMotionGraphRaw } from "./ambient-house-motion-graph";

/**
 * Founder-approved Ambient House motion graph seed, cleaned from the raw editor
 * export on 2026-08-21.
 *
 * Cleanup rule applied here:
 * - preserve every horizontal lane exactly as authored;
 * - trim each diagonal's orphan prefix/suffix so both raw endpoints land on a
 *   horizontal lane;
 * - keep diagonals that cross intermediate horizontal lanes as one authored raw
 *   line; canonicalizeAmbientMotionGraph() will split those crossings into
 *   movement connector segments at runtime/editor preview.
 */
export const AMBIENT_HOUSE_MOTION_GRAPH_SEED: AmbientMotionGraphRaw = {
  canvas: {
    width: 1920,
    height: 1080,
  },
  miniCharacter: {
    width: 164,
    height: 115,
    anchor: "center",
    centerOffset: {
      x: 82,
      y: 57.5,
    },
  },
  horizontalLanes: [
    {
      id: "lane-01",
      y: 931,
      x1: 90,
      x2: 1745,
      midLayer: "front",
    },
    {
      id: "lane-04",
      y: 885,
      x1: 63,
      x2: 1736,
      midLayer: "front",
    },
    {
      id: "lane-06",
      y: 807,
      x1: 545,
      x2: 869,
      midLayer: "behind",
    },
    {
      id: "lane-07",
      y: 813,
      x1: 1290,
      x2: 1676,
      midLayer: "behind",
    },
    {
      id: "lane-08",
      y: 830,
      x1: 444,
      x2: 537,
      midLayer: "front",
    },
    {
      id: "lane-09",
      y: 761,
      x1: 150,
      x2: 348,
      midLayer: "behind",
    },
    {
      id: "lane-10",
      y: 469,
      x1: 210,
      x2: 867,
      midLayer: "behind",
    },
    {
      id: "lane-11",
      y: 472,
      x1: 179,
      x2: 1024,
      midLayer: "front",
    },
  ],
  rawConnectors: [
    {
      id: "connector-01",
      from: { x: 584.9, y: 807 },
      to: { x: 517, y: 885 },
    },
    {
      id: "connector-02",
      from: { x: 548.2, y: 807 },
      to: { x: 186.6, y: 931 },
    },
    {
      id: "connector-03",
      from: { x: 866.4, y: 807 },
      to: { x: 875.5, y: 931 },
    },
    {
      id: "connector-04",
      from: { x: 1675, y: 813 },
      to: { x: 1732.6, y: 885 },
    },
    {
      id: "connector-05",
      from: { x: 1391.7, y: 813 },
      to: { x: 1378.6, y: 931 },
    },
    {
      id: "connector-06",
      from: { x: 1306.7, y: 813 },
      to: { x: 1303.6, y: 931 },
    },
    {
      id: "connector-07",
      from: { x: 533.7, y: 931 },
      to: { x: 521.1, y: 885 },
    },
    {
      id: "connector-08",
      from: { x: 180.9, y: 761 },
      to: { x: 101.1, y: 931 },
    },
    {
      id: "connector-09",
      from: { x: 231.6, y: 469 },
      to: { x: 229.8, y: 472 },
    },
    {
      id: "connector-10",
      from: { x: 849.2, y: 469 },
      to: { x: 850.3, y: 472 },
    },
    {
      id: "connector-11",
      from: { x: 971.9, y: 472 },
      to: { x: 947.7, y: 931 },
    },
    {
      id: "connector-12",
      from: { x: 1013.8, y: 472 },
      to: { x: 1074, y: 931 },
    },
  ],
};
