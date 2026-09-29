import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WARD_CALIBRATION,
  buildWardRenderMetadata,
  readWardCalibration,
  wardAssetUrl,
} from "./ward-calibration";

test("reads canonical flat calibration metadata", () => {
  const value = readWardCalibration({ anchor: "character", zIndex: 50, offsetX: 4, offsetY: -3, scale: 1.25, rotation: 6 });
  assert.deepEqual(value, { ...DEFAULT_WARD_CALIBRATION, zIndex: 50, offsetX: 4, offsetY: -3, scale: 1.25, rotation: 6 });
});

test("reads legacy nested calibration as fallback only", () => {
  const value = readWardCalibration({ transform: { offsetX: 7, scale: 1.4 }, layer: { zIndex: 44 } });
  assert.equal(value.offsetX, 7);
  assert.equal(value.scale, 1.4);
  assert.equal(value.zIndex, 44);
});

test("writes only flat canonical metadata and supplies layer anchor", () => {
  const next = buildWardRenderMetadata(
    { transform: { offsetX: 99 }, layer: { zIndex: 2 }, occlusionGroup: "hair", compatibilityTags: ["v1"] },
    "LAYER",
    { ...DEFAULT_WARD_CALIBRATION, offsetX: 8, zIndex: 31 },
    false,
  );
  assert.deepEqual(next, {
    occlusionGroup: "hair",
    compatibilityTags: ["v1"],
    offsetX: 8,
    offsetY: 0,
    scale: 1,
    rotation: 0,
    zIndex: 31,
    anchor: "character",
  });
});

test("writes explicit loop contract for WEBM", () => {
  const next = buildWardRenderMetadata({}, "WEBM", DEFAULT_WARD_CALIBRATION, true);
  assert.equal(next.loop, true);
  assert.equal("transform" in next, false);
  assert.equal("layer" in next, false);
});

test("resolves public Ward asset URLs", () => {
  assert.equal(wardAssetUrl("pinoria/assets/a.png"), "https://assets.pinohouse.art/pinoria/assets/a.png");
  assert.equal(wardAssetUrl("https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(wardAssetUrl(null), "");
});
