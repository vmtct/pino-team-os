import {
  ambientInnerBoundaryIndexAtPoint,
  isAmbientMiniCharacterInFrontOfMidWithRules,
  isPointInsidePolygon,
  type AmbientHouseDepthRules,
  type AmbientHousePoint,
} from "./ambient-house-navmesh";

export type AmbientDepthState = {
  inFrontOfMid: boolean;
  lockedInnerBoundary: number | null;
};

export function initialAmbientDepthState(point: AmbientHousePoint, rules: AmbientHouseDepthRules): AmbientDepthState {
  return {
    inFrontOfMid: isAmbientMiniCharacterInFrontOfMidWithRules(point.y, rules),
    lockedInnerBoundary: null,
  };
}

/**
 * Inner-boundary rule:
 * - entering an inner zone freezes the previous front/behind state;
 * - while inside, MID ordering never changes even if Y crosses a threshold;
 * - leaving the zone releases the lock and normal threshold logic resumes.
 */
export function resolveAmbientDepthState(
  previous: AmbientDepthState,
  point: AmbientHousePoint,
  rules: AmbientHouseDepthRules,
  innerBoundaries: readonly (readonly AmbientHousePoint[])[],
): AmbientDepthState {
  const zoneIndex = ambientInnerBoundaryIndexAtPoint(point, innerBoundaries);

  if (zoneIndex >= 0) {
    return {
      inFrontOfMid: previous.inFrontOfMid,
      lockedInnerBoundary: previous.lockedInnerBoundary ?? zoneIndex,
    };
  }

  return {
    inFrontOfMid: isAmbientMiniCharacterInFrontOfMidWithRules(point.y, rules),
    lockedInnerBoundary: null,
  };
}

export function distanceBetween(a: AmbientHousePoint, b: AmbientHousePoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerpPoint(a: AmbientHousePoint, b: AmbientHousePoint, t: number): AmbientHousePoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function polygonBounds(points: readonly AmbientHousePoint[]) {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

export function randomPointInPolygon(points: readonly AmbientHousePoint[], attempts = 120): AmbientHousePoint | null {
  if (points.length < 3) return null;
  const bounds = polygonBounds(points);
  if (!bounds) return null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const point = {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
    };
    if (isPointInsidePolygon(point, points)) return point;
  }
  return null;
}

/** Samples a proposed straight segment so a concave movement/room polygon is never cut across illegally. */
export function isStraightSegmentAllowed(
  from: AmbientHousePoint,
  to: AmbientHousePoint,
  allowed: (point: AmbientHousePoint) => boolean,
  sampleStepPx = 18,
) {
  const distance = distanceBetween(from, to);
  const samples = Math.max(2, Math.ceil(distance / sampleStepPx));
  for (let index = 0; index <= samples; index += 1) {
    const point = lerpPoint(from, to, index / samples);
    if (!allowed(point)) return false;
  }
  return true;
}
