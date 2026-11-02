import type { PresenceExperience } from "./presence-contract";
import type { AmbientMotionGraph } from "./ambient-house-motion";

/**
 * PAP-651: resolve a semantic House area ONLY from canonical experience facts
 * and an explicitly approved mapping. Never infer a learner's area from
 * display names, synthetic defaults, or the first matching lane.
 */
export type AmbientHouseArea = {
  id: string;
  laneIds: readonly string[];
  pathCodes?: readonly string[];
  learningSpaceCodes?: readonly string[];
};

export type AmbientAreaResolution =
  | { kind: "AREA"; areaId: string; laneIds: readonly string[] }
  | { kind: "GLOBAL"; reason: "NO_CONTEXT" | "NO_MATCH" | "AMBIGUOUS" | "INVALID_CONFIG" };

export function resolveAmbientHouseArea(
  experience: PresenceExperience,
  graph: AmbientMotionGraph,
  areas: readonly AmbientHouseArea[],
): AmbientAreaResolution {
  if (!experience?.path?.code && !experience?.learningSpace?.code) {
    return { kind: "GLOBAL", reason: "NO_CONTEXT" };
  }
  const validLanes = new Set(graph.horizontalLanes.map((lane) => lane.id));
  const matching = areas.filter((area) => {
    const byPath = !!experience.path?.code && (area.pathCodes ?? []).includes(experience.path.code);
    const bySpace = !!experience.learningSpace?.code && (area.learningSpaceCodes ?? []).includes(experience.learningSpace.code);
    return byPath || bySpace;
  });
  if (matching.length === 0) return { kind: "GLOBAL", reason: "NO_MATCH" };
  if (matching.length !== 1) return { kind: "GLOBAL", reason: "AMBIGUOUS" };
  const area = matching[0]!;
  if (!area.id || !area.laneIds.length || new Set(area.laneIds).size !== area.laneIds.length ||
      area.laneIds.some((id) => !validLanes.has(id))) {
    return { kind: "GLOBAL", reason: "INVALID_CONFIG" };
  }
  return { kind: "AREA", areaId: area.id, laneIds: [...area.laneIds] };
}

