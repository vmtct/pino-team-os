export type AmbientHousePoint = Readonly<{ x: number; y: number }>;

export const AMBIENT_HOUSE_CANVAS = {
  width: 1920,
  height: 1080,
} as const;

export const AMBIENT_MINI_CHARACTER = {
  width: 164,
  height: 115,
  anchor: "top-left",
} as const;

/** Canonical 1920x1080 movement mesh approved from the Ambient editor. */
export const AMBIENT_HOUSE_OUTER_BOUNDARY: readonly AmbientHousePoint[] = [
  { x: 89, y: 700 },
  { x: 51, y: 734 },
  { x: 72, y: 750 },
  { x: 268, y: 935 },
  { x: 1372, y: 932 },
  { x: 1675, y: 801 },
  { x: 1671, y: 738 },
  { x: 1233, y: 732 },
  { x: 1232, y: 803 },
  { x: 1177, y: 802 },
  { x: 1146, y: 728 },
  { x: 1037, y: 726 },
  { x: 1067.8, y: 836.3 },
  { x: 1026.4, y: 836.3 },
  { x: 961, y: 581 },
  { x: 987.9, y: 441.9 },
  { x: 988, y: 417 },
  { x: 983, y: 393 },
  { x: 186, y: 390 },
  { x: 73.4, y: 441.9 },
  { x: 912.9, y: 441.9 },
  { x: 912.9, y: 579.1 },
  { x: 878, y: 668 },
  { x: 833, y: 840 },
  { x: 806, y: 841 },
  { x: 804, y: 727 },
  { x: 508, y: 725 },
  { x: 390, y: 745 },
  { x: 129, y: 744 },
  { x: 99, y: 720 },
  { x: 262, y: 720 },
  { x: 269, y: 698 },
] as const;

/** Current no-go markers. A polygon only blocks movement once it has 3+ points. */
export const AMBIENT_HOUSE_INNER_BOUNDARIES = [
  [{ x: 516, y: 864.1 }],
  [{ x: 1408.3, y: 823.2 }],
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
 * Learner home/wander areas. These intentionally start empty and are authored
 * visually in /pinoria-tv/ambient-debug. During arrival/transit a learner may
 * use the global mesh; once they enter their assigned area, ambient wandering
 * can be constrained to that area's polygon.
 */
export const AMBIENT_HOUSE_AREAS: Record<AmbientHouseAreaId, readonly AmbientHousePoint[]> = {
  reception: [],
  artchitect: [],
  "little-piner": [],
  pianohouse: [],
};

export const AMBIENT_HOUSE_DEPTH_RULES = {
  groundFrontMinYExclusive: 836.3,
  groundFrontMaxYExclusive: 965,
  upperFrontY: 441.9,
  upperFrontTolerancePx: 3,
  houseFrontAlwaysOnTop: true,
} as const;

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
