import type { Point, SpatialConfig } from "./pinoria-tv-spatial-config-client";
import { boundsOfPoints, translatePolygon } from "./pinoria-tv-mesh-geometry";

export type MeshDragPick = { kind: "lane" | "pin" | "area" | "connector"; id: string };

/** PAP-1262: same immutable geometry transaction for every pointermove.
 * No Core writes happen until the user explicitly saves a draft. */
export function applyMeshDrag(
  origin: SpatialConfig,
  pick: MeshDragPick,
  from: Point,
  to: Point,
  vertexIndex?: number,
): SpatialConfig {
  const next = structuredClone(origin);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (pick.kind === "lane") {
    const lane = next.graph.horizontalLanes.find(item => item.id === pick.id);
    if (lane) {
      lane.y = Math.max(0, Math.min(1080, lane.y + dy));
      for (const pin of next.emergencePins) if (pin.laneId === lane.id) pin.y = lane.y;
    }
  } else if (pick.kind === "pin") {
    const pin = next.emergencePins.find(item => item.id === pick.id);
    const lane = next.graph.horizontalLanes.find(item => item.id === pin?.laneId);
    if (pin && lane) pin.x = Math.max(lane.x1 + 36, Math.min(lane.x2 - 36, pin.x + dx));
  } else if (pick.kind === "area") {
    const area = next.areas.find(item => item.id === pick.id);
    if (area) {
      if (area.points && vertexIndex !== undefined) {
        area.points[vertexIndex] = { x: Math.max(0, Math.min(1920, to.x)), y: Math.max(0, Math.min(1080, to.y)) };
        area.bounds = boundsOfPoints(area.points);
      } else if (area.points) {
        area.points = translatePolygon(area.points, dx, dy);
        area.bounds = boundsOfPoints(area.points);
      } else {
        area.bounds.x = Math.max(0, Math.min(1920 - area.bounds.width, area.bounds.x + dx));
        area.bounds.y = Math.max(0, Math.min(1080 - area.bounds.height, area.bounds.y + dy));
      }
    }
  }
  return next;
}
