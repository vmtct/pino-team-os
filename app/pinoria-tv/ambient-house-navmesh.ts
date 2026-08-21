export type AmbientHousePoint = Readonly<{ x: number; y: number }>;

export const AMBIENT_HOUSE_CANVAS = {
  width: 1980,
  height: 1080,
} as const;

export const AMBIENT_MINI_CHARACTER = {
  width: 164,
  height: 115,
  anchor: "top-left",
} as const;

/**
 * Canonical walkable outer boundary for Ambient House v1.
 *
 * Coordinates are authored on the 1980x1080 canonical canvas and represent
 * the TOP-LEFT anchor of the 164x115 mini-character viewport.
 *
 * The earlier draft point (105.3, 810.5) and the repeated terminal
 * (217.9, 812) were intentionally removed so this remains a simple polygon.
 */
export const AMBIENT_HOUSE_OUTER_BOUNDARY: readonly AmbientHousePoint[] = [
  { x: 293.1, y: 812 },
  { x: 217.9, y: 812 },
  { x: 0, y: 851.2 },
  { x: 0, y: 965 },
  { x: 1865, y: 965 },
  { x: 1865, y: 857 },
  { x: 1720.8, y: 792.8 },
  { x: 1309.2, y: 792.8 },
  { x: 1309.2, y: 799.8 },
  { x: 1216.4, y: 799.8 },
  { x: 1197.5, y: 783.1 },
  { x: 1111.7, y: 783.1 },
  { x: 1101.2, y: 836.3 },
  { x: 1058.5, y: 836.3 },
  { x: 1013.2, y: 579.1 },
  { x: 1018.8, y: 441.9 },
  { x: 1780.7, y: 441.9 },
  { x: 1628.3, y: 435.3 },
  { x: 186.4, y: 435.3 },
  { x: 75.7, y: 441.9 },
  { x: 941.4, y: 441.9 },
  { x: 941.4, y: 579.1 },
  { x: 919.9, y: 836.3 },
  { x: 850.2, y: 836.3 },
  { x: 829.5, y: 791.2 },
  { x: 519.3, y: 791.2 },
  { x: 430.2, y: 801.9 },
  { x: 293.1, y: 851.2 },
  { x: 82.9, y: 851.2 },
] as const;

/** Areas the mini-character top-left anchor may not enter. */
export const AMBIENT_HOUSE_INNER_BOUNDARIES = [
  [
    { x: 608.9, y: 822.1 },
    { x: 532.1, y: 864.1 },
    { x: 742.6, y: 873.8 },
    { x: 787, y: 819.3 },
  ],
  [
    { x: 1557.4, y: 846 },
    { x: 1452.3, y: 823.2 },
    { x: 1547, y: 807.3 },
    { x: 1652.9, y: 834.2 },
  ],
] as const satisfies readonly (readonly AmbientHousePoint[])[];

export const AMBIENT_HOUSE_DEPTH_RULES = {
  /** Ground-floor foreground band: mini-character renders over HOUSE_MID. */
  groundFrontMinYExclusive: 836.3,
  groundFrontMaxYExclusive: 965,
  /** Upper-floor walking line: mini-character renders over HOUSE_MID. */
  upperFrontY: 441.9,
  upperFrontTolerancePx: 3,
  /** HOUSE_FRONT always renders above the mini-character. */
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

/** Boundary-inclusive point-in-polygon test. */
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

/**
 * Canonical movement guard for the mini-character TOP-LEFT anchor.
 * The anchor must remain inside the outer boundary and outside both no-go areas.
 */
export function isAmbientMiniCharacterAnchorWalkable(anchor: AmbientHousePoint) {
  if (!isPointInsidePolygon(anchor, AMBIENT_HOUSE_OUTER_BOUNDARY)) return false;

  return !AMBIENT_HOUSE_INNER_BOUNDARIES.some((blocked) =>
    isPointInsidePolygon(anchor, blocked),
  );
}

/** True when the mini-character should render above HOUSE_MID. */
export function isAmbientMiniCharacterInFrontOfMid(y: number) {
  const groundFront =
    y > AMBIENT_HOUSE_DEPTH_RULES.groundFrontMinYExclusive &&
    y < AMBIENT_HOUSE_DEPTH_RULES.groundFrontMaxYExclusive;

  const upperFront =
    Math.abs(y - AMBIENT_HOUSE_DEPTH_RULES.upperFrontY) <=
    AMBIENT_HOUSE_DEPTH_RULES.upperFrontTolerancePx;

  return groundFront || upperFront;
}

/** Scale canonical coordinates into the actual rendered Ambient House viewport. */
export function ambientHousePointToViewport(
  point: AmbientHousePoint,
  renderedWidth: number,
  renderedHeight: number,
): AmbientHousePoint {
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
