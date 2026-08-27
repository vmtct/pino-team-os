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

/** Canonical 1920x1080 movement mesh using the mini-character CENTER anchor. */
export const AMBIENT_HOUSE_OUTER_BOUNDARY: readonly AmbientHousePoint[] = [
  { x: 171, y: 757.5 }, { x: 133, y: 791.5 }, { x: 154, y: 807.5 }, { x: 350, y: 992.5 },
  { x: 1454, y: 989.5 }, { x: 1757, y: 858.5 }, { x: 1753, y: 795.5 }, { x: 1315, y: 789.5 },
  { x: 1314, y: 860.5 }, { x: 1259, y: 859.5 }, { x: 1228, y: 785.5 }, { x: 1119, y: 783.5 },
  { x: 1149.8, y: 893.8 }, { x: 1108.4, y: 893.8 }, { x: 1043, y: 638.5 }, { x: 1069.9, y: 499.4 },
  { x: 1070, y: 474.5 }, { x: 1065, y: 450.5 }, { x: 268, y: 447.5 }, { x: 155.4, y: 499.4 },
  { x: 994.9, y: 499.4 }, { x: 994.9, y: 636.6 }, { x: 960, y: 725.5 }, { x: 915, y: 897.5 },
  { x: 888, y: 898.5 }, { x: 886, y: 784.5 }, { x: 590, y: 782.5 }, { x: 472, y: 802.5 },
  { x: 211, y: 801.5 }, { x: 181, y: 777.5 }, { x: 344, y: 777.5 }, { x: 351, y: 755.5 },
] as const;

/** Legacy depth-lock geometry retained only for compatibility while MID is disabled. */
export const AMBIENT_HOUSE_INNER_BOUNDARIES = [
  [{ x: 598, y: 921.6 }],
  [{ x: 1490.3, y: 880.7 }],
] as const satisfies readonly (readonly AmbientHousePoint[])[];

export const AMBIENT_HOUSE_AREA_IDS = ["reception", "artchitect", "little-piner", "pianohouse"] as const;
export type AmbientHouseAreaId = (typeof AMBIENT_HOUSE_AREA_IDS)[number];

export const AMBIENT_HOUSE_AREA_LABELS: Record<AmbientHouseAreaId, string> = {
  reception: "Reception",
  artchitect: "Artchitect",
  "little-piner": "Little Piner",
  pianohouse: "Piano House",
};

/** Founder-approved canonical learner designated areas. */
export const AMBIENT_HOUSE_AREAS: Record<AmbientHouseAreaId, readonly AmbientHousePoint[]> = {
  reception: [
    { x: 168, y: 738 },
    { x: 467, y: 728 },
    { x: 466, y: 915 },
    { x: 333, y: 1002 },
    { x: 111, y: 787 },
  ],
  artchitect: [
    { x: 488, y: 723 },
    { x: 482, y: 991 },
    { x: 885, y: 995 },
    { x: 881, y: 764 },
  ],
  "little-piner": [
    { x: 1270, y: 773 },
    { x: 1281, y: 994 },
    { x: 1472, y: 1002 },
    { x: 1782, y: 872 },
    { x: 1768, y: 768 },
  ],
  pianohouse: [
    { x: 276, y: 426 },
    { x: 122, y: 507 },
    { x: 794, y: 515 },
    { x: 784, y: 419 },
  ],
};

export type AmbientHouseDepthRules = {
  groundFrontMinYExclusive: number;
  groundFrontMaxYExclusive: number;
  upperFrontY: number;
  upperFrontTolerancePx: number;
  houseFrontAlwaysOnTop: true;
};

/** Legacy MID depth config retained only for compatibility while MID is disabled. */
export const AMBIENT_HOUSE_DEPTH_RULES: AmbientHouseDepthRules = {
  groundFrontMinYExclusive: 893.8,
  groundFrontMaxYExclusive: 1022.5,
  upperFrontY: 499.4,
  upperFrontTolerancePx: 3,
  houseFrontAlwaysOnTop: true,
};

export function ambientMiniCharacterTopLeftFromAnchor(anchor: AmbientHousePoint): AmbientHousePoint {
  return { x: anchor.x - AMBIENT_MINI_CHARACTER.centerOffset.x, y: anchor.y - AMBIENT_MINI_CHARACTER.centerOffset.y };
}

export function ambientMiniCharacterBottomRightFromAnchor(anchor: AmbientHousePoint): AmbientHousePoint {
  return { x: anchor.x + AMBIENT_MINI_CHARACTER.centerOffset.x, y: anchor.y + AMBIENT_MINI_CHARACTER.centerOffset.y };
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

/** Global collision rule: only the outer movement mesh constrains movement. */
export function isAmbientMiniCharacterAnchorWalkable(anchor: AmbientHousePoint) {
  return isPointInsidePolygon(anchor, AMBIENT_HOUSE_OUTER_BOUNDARY);
}

export function ambientInnerBoundaryIndexAtPoint(
  anchor: AmbientHousePoint,
  boundaries: readonly (readonly AmbientHousePoint[])[] = AMBIENT_HOUSE_INNER_BOUNDARIES,
) {
  return boundaries.findIndex((zone) => zone.length >= 3 && isPointInsidePolygon(anchor, zone));
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

export function isAmbientMiniCharacterInFrontOfMidWithRules(y: number, rules: AmbientHouseDepthRules) {
  const groundFront = y > rules.groundFrontMinYExclusive && y < rules.groundFrontMaxYExclusive;
  const upperFront = Math.abs(y - rules.upperFrontY) <= rules.upperFrontTolerancePx;
  return groundFront || upperFront;
}

export function isAmbientMiniCharacterInFrontOfMid(y: number) {
  return isAmbientMiniCharacterInFrontOfMidWithRules(y, AMBIENT_HOUSE_DEPTH_RULES);
}

export function ambientHousePointToViewport(point: AmbientHousePoint, renderedWidth: number, renderedHeight: number): AmbientHousePoint {
  return { x: (point.x / AMBIENT_HOUSE_CANVAS.width) * renderedWidth, y: (point.y / AMBIENT_HOUSE_CANVAS.height) * renderedHeight };
}

export function ambientMiniCharacterSizeToViewport(renderedWidth: number, renderedHeight: number) {
  return {
    width: (AMBIENT_MINI_CHARACTER.width / AMBIENT_HOUSE_CANVAS.width) * renderedWidth,
    height: (AMBIENT_MINI_CHARACTER.height / AMBIENT_HOUSE_CANVAS.height) * renderedHeight,
  };
}
