export type AmbientHousePoint = Readonly<{ x: number; y: number }>;

export const AMBIENT_HOUSE_CANVAS = {
  width: 1920,
  height: 1080,
} as const;

export const AMBIENT_MINI_CHARACTER = {
  width: 164,
  height: 115,
  anchor: "center",
  centerOffset: {
    x: 82,
    y: 57.5,
  },
} as const;

/**
 * Canonical 1920x1080 movement mesh using the mini-character CENTER anchor.
 *
 * Previous geometry was authored against the 164x115 mini-character top-left
 * anchor. The character center is +82px on X and +57.5px on Y from that old
 * anchor, so every movement-space point below was translated by (+82,+57.5).
 * This preserves the exact same visual/physical boundary alignment.
 */
export const AMBIENT_HOUSE_OUTER_BOUNDARY: readonly AmbientHousePoint[] = [
  { x: 171, y: 757.5 },
  { x: 133, y: 791.5 },
  { x: 154, y: 807.5 },
  { x: 350, y: 992.5 },
  { x: 1454, y: 989.5 },
  { x: 1757, y: 858.5 },
  { x: 1753, y: 795.5 },
  { x: 1315, y: 789.5 },
  { x: 1314, y: 860.5 },
  { x: 1259, y: 859.5 },
  { x: 1228, y: 785.5 },
  { x: 1119, y: 783.5 },
  { x: 1149.8, y: 893.8 },
  { x: 1108.4, y: 893.8 },
  { x: 1043, y: 638.5 },
  { x: 1069.9, y: 499.4 },
  { x: 1070, y: 474.5 },
  { x: 1065, y: 450.5 },
  { x: 268, y: 447.5 },
  { x: 155.4, y: 499.4 },
  { x: 994.9, y: 499.4 },
  { x: 994.9, y: 636.6 },
  { x: 960, y: 725.5 },
  { x: 915, y: 897.5 },
  { x: 888, y: 898.5 },
  { x: 886, y: 784.5 },
  { x: 590, y: 782.5 },
  { x: 472, y: 802.5 },
  { x: 211, y: 801.5 },
  { x: 181, y: 777.5 },
  { x: 344, y: 777.5 },
  { x: 351, y: 755.5 },
] as const;

/** Current no-go markers translated into center-anchor space. */
export const AMBIENT_HOUSE_INNER_BOUNDARIES = [
  [{ x: 598, y: 921.6 }],
  [{ x: 1490.3, y: 880.7 }],
] as const satisfies readonly (readonly AmbientHousePoint[])[];

export const AMBIENT_HOUSE_AREA_IDS = [
  "reception",
  "artchitect",
  "little-piner",
  "pianohouse",
] as const;

export type AmbientHouseAreaId = (typeof AMBIENT_HOUSE_AREA_IDS)[number];

export const AMBIENT_HOUSE_AREA_LABELS: Record<AmbientHouseAreaId, string> = {
  reception: "Reception",
  artchitect: "Artchitect",
  "little-piner": "Little Piner",
  pianohouse: "Piano House",
};

/**
 * Learner home/wander areas are authored directly in center-anchor space.
 * During arrival/transit a learner may use the global mesh; once they enter
 * their assigned area, ambient wandering can be constrained to that polygon.
 */
export const AMBIENT_HOUSE_AREAS: Record<AmbientHouseAreaId, readonly AmbientHousePoint[]> = {
  reception: [],
  artchitect: [],
  "little-piner": [],
  pianohouse: [],
};

/** Depth thresholds also moved +57.5px because Y now references character center. */
export const AMBIENT_HOUSE_DEPTH_RULES = {
  groundFrontMinYExclusive: 893.8,
  groundFrontMaxYExclusive: 1022.5,
  upperFrontY: 499.4,
  upperFrontTolerancePx: 3,
  houseFrontAlwaysOnTop: true,
} as const;

export function ambientMiniCharacterTopLeftFromAnchor(anchor: AmbientHousePoint): AmbientHousePoint {
  return {
    x: anchor.x - AMBIENT_MINI_CHARACTER.centerOffset.x,
    y: anchor.y - AMBIENT_MINI_CHARACTER.centerOffset.y,
  };
}

export function ambientMiniCharacterBottomRightFromAnchor(anchor: AmbientHousePoint): AmbientHousePoint {
  return {
    x: anchor.x + AMBIENT_MINI_CHARACTER.centerOffset.x,
    y: anchor.y + AMBIENT_MINI_CHARACTER.centerOffset.y,
  };
}

function pointOnSegment(point: AmbientHousePoint, a: AmbientHousePoint, b: AmbientHousePoint, epsilon = 1e-6) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -epsilon) return false;
  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= squaredLength + epsilon;
}

export function isPointInsidePolygon(point: AmbientHousePoint, polygon: readonly AmbientHousePoint[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j];
    const b = polygon[i];
    if (pointOnSegment(point, a, b)) return true;
    const crossesScanline = (b.y > point.y) !== (a.y > point.y);
    if (!crossesScanline) continue;
    const intersectionX = ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x;
    if (point.x < intersectionX) inside = !inside;
  }
  return inside;
}

export function isAmbientMiniCharacterAnchorWalkable(anchor: AmbientHousePoint) {
  if (!isPointInsidePolygon(anchor, AMBIENT_HOUSE_OUTER_BOUNDARY)) return false;
  return !AMBIENT_HOUSE_INNER_BOUNDARIES.some((blocked) => isPointInsidePolygon(anchor, blocked));
}

export function isAmbientMiniCharacterAnchorInArea(
  anchor: AmbientHousePoint,
  areaId: AmbientHouseAreaId,
  areas: Record<AmbientHouseAreaId, readonly AmbientHousePoint[]> = AMBIENT_HOUSE_AREAS,
) {
  return isPointInsidePolygon(anchor, areas[areaId]);
}

export function isAmbientMiniCharacterWalkableInArea(
  anchor: AmbientHousePoint,
  areaId: AmbientHouseAreaId,
  areas: Record<AmbientHouseAreaId, readonly AmbientHousePoint[]> = AMBIENT_HOUSE_AREAS,
) {
  return isAmbientMiniCharacterAnchorWalkable(anchor) && isAmbientMiniCharacterAnchorInArea(anchor, areaId, areas);
}

export function isAmbientMiniCharacterInFrontOfMid(y: number) {
  const groundFront = y > AMBIENT_HOUSE_DEPTH_RULES.groundFrontMinYExclusive && y < AMBIENT_HOUSE_DEPTH_RULES.groundFrontMaxYExclusive;
  const upperFront = Math.abs(y - AMBIENT_HOUSE_DEPTH_RULES.upperFrontY) <= AMBIENT_HOUSE_DEPTH_RULES.upperFrontTolerancePx;
  return groundFront || upperFront;
}

export function ambientHousePointToViewport(point: AmbientHousePoint, renderedWidth: number, renderedHeight: number): AmbientHousePoint {
  return {
    x: (point.x / AMBIENT_HOUSE_CANVAS.width) * renderedWidth,
    y: (point.y / AMBIENT_HOUSE_CANVAS.height) * renderedHeight,
  };
}

export function ambientMiniCharacterSizeToViewport(renderedWidth: number, renderedHeight: number) {
  return {
    width: (AMBIENT_MINI_CHARACTER.width / AMBIENT_HOUSE_CANVAS.width) * renderedWidth,
    height: (AMBIENT_MINI_CHARACTER.height / AMBIENT_HOUSE_CANVAS.height) * renderedHeight,
  };
}
