/** PAP-650 / PNR-TV · PAP-1646 — PRESENTATION-ONLY fitting.
 * A frame ratio is not proof of an authorized Policy, Center, or Core data.
 * No Policy ID parsing, runtime fetch, Device session, ACK or observation here.
 */
export type TvPolicyViewerAspect = "16:9" | "9:16";

export type TvPolicyViewerGeometry = Readonly<{
  width: number;
  height: number;
  x: number;
  y: number;
}>;

const FRAME_UNITS: Record<TvPolicyViewerAspect, readonly [number, number]> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
};

/** Always contain the frame in the browser viewport; never crop the scene. */
export function fitTvPolicyViewerFrame(
  viewport: Readonly<{ width: number; height: number }>,
  aspect: TvPolicyViewerAspect,
): TvPolicyViewerGeometry | null {
  const { width, height } = viewport;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const frame = FRAME_UNITS[aspect];
  if (!frame) return null;
  const scale = Math.min(width / frame[0], height / frame[1]);
  const frameWidth = frame[0] * scale;
  const frameHeight = frame[1] * scale;
  return {
    width: frameWidth,
    height: frameHeight,
    x: (width - frameWidth) / 2,
    y: (height - frameHeight) / 2,
  };
}
