import type { AmbientMotionGraph } from "../app/pinoria-tv/ambient-house-motion";
import type { AmbientHouseArea } from "../app/pinoria-tv/ambient-house-area";

export type PublishedHouseSpatialConfig = {
  appliedVersion: string;
  /** Database-issued revision of the active spatial configuration. */
  appliedRevision?: number;
  scope: string;
  configuration: {
    schemaVersion: 1;
    canvas: { width: 1920; height: 1080 };
    graph: { horizontalLanes: AmbientMotionGraph["horizontalLanes"]; rawConnectors: NonNullable<AmbientMotionGraph["rawConnectors"]> };
    areas: AmbientHouseArea[];
    emergencePins: Array<{ id: string; areaId?: string; laneId: string; x: number; y: number }>;
  };
};
export type HouseSpatialRefresh = { active: PublishedHouseSpatialConfig | null; pending: PublishedHouseSpatialConfig | null };
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const point = (x: unknown) => record(x) && finite(x.x) && finite(x.y) && x.x >= 0 && x.y >= 0 && x.x <= 1920 && x.y <= 1080;
/** Defensive client decode: fail closed and retain the old last-known-good config. */
export function parsePublishedHouseSpatialConfig(input: unknown): PublishedHouseSpatialConfig | null {
  if (!record(input) || typeof input.appliedVersion !== "string" || !input.appliedVersion
      || typeof input.scope !== "string" || !record(input.configuration)
      || (input.appliedRevision !== undefined && (!Number.isSafeInteger(input.appliedRevision) || (input.appliedRevision as number) < 1))) return null;
  const cfg = input.configuration;
  if (cfg.schemaVersion !== 1 || !record(cfg.canvas) || cfg.canvas.width !== 1920 || cfg.canvas.height !== 1080
      || !record(cfg.graph) || !Array.isArray(cfg.graph.horizontalLanes) || !Array.isArray(cfg.graph.rawConnectors)
      || !Array.isArray(cfg.areas) || !Array.isArray(cfg.emergencePins)) return null;
  const lanes = cfg.graph.horizontalLanes, links = cfg.graph.rawConnectors, areas = cfg.areas, pins = cfg.emergencePins;
  if (!lanes.length || lanes.length > 100 || links.length > 300 || areas.length > 80 || pins.length > 200) return null;
  const validLanes = new Set<string>();
  for (const lane of lanes) {
    if (!record(lane) || typeof lane.id !== "string" || !lane.id || validLanes.has(lane.id)
      || !finite(lane.x1) || !finite(lane.x2) || !finite(lane.y) || lane.x1 < 0 || lane.x2 > 1920
      || lane.x2-lane.x1 < 72 || lane.y < 0 || lane.y > 1080
      || (lane.midLayer !== "front" && lane.midLayer !== "behind")) return null;
    validLanes.add(lane.id);
  }
  for (const link of links) if (!record(link) || typeof link.id !== "string" || !point(link.from) || !point(link.to)) return null;
  const owner = new Map<string, string>();
  for (const area of areas) {
    if (!record(area) || typeof area.id !== "string" || !Array.isArray(area.laneIds) || area.laneIds.length===0
      || area.laneIds.some((id: unknown) => !validLanes.has(String(id)))
      || !record(area.bounds) || !finite(area.bounds.x) || !finite(area.bounds.y)
      || !finite(area.bounds.width) || !finite(area.bounds.height) || area.bounds.width<=0 || area.bounds.height<=0
      || area.bounds.x < 0 || area.bounds.y < 0
      || area.bounds.x+area.bounds.width>1920 || area.bounds.y+area.bounds.height>1080) return null;
    if(area.points!==undefined){
      if(!Array.isArray(area.points)||area.points.length<3||area.points.length>32
        ||area.points.some((p:unknown)=>!record(p)||!point(p)))return null;
    }
    for (const key of ["pathCodes", "learningSpaceCodes"] as const) {
      const codes = area[key];
      if (codes!==undefined && (!Array.isArray(codes) || codes.some(x=>typeof x!=="string"))) return null;
      for (const code of (codes as string[] | undefined) ?? []) {
        const k=key+":"+code;
        if(owner.has(k)&&owner.get(k)!==area.id)return null;
        owner.set(k,area.id);
      }
    }
  }
  for(const pin of pins) if(!record(pin)||typeof pin.id!=="string"||(pin.areaId!==undefined&&typeof pin.areaId!=="string")||typeof pin.laneId!=="string"||!point(pin))return null;
  return input as PublishedHouseSpatialConfig;
}
/**
 * Applying a graph while actors are inside could resnap positions or corrupt a
 * connector traversal. Hold the new revision until House is empty instead.
 */
export function reconcileHouseSpatialRefresh(
  state: HouseSpatialRefresh,
  incoming: PublishedHouseSpatialConfig | null,
  liveActorCount: number,
): HouseSpatialRefresh {
  const candidate = incoming ?? state.pending;
  if (!candidate || candidate.appliedVersion===state.active?.appliedVersion) return {active:state.active,pending:null};
  if (liveActorCount>0) return {active:state.active,pending:candidate};
  return {active:candidate,pending:null};
}
