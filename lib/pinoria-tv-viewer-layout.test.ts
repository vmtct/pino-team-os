/** PAP-650 / PNR-TV · PAP-1646 — no Core or runtime fixtures. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fitTvPolicyViewerFrame, type TvPolicyViewerAspect } from "./pinoria-tv-viewer-layout";

function expectContained(width: number, height: number, aspect: TvPolicyViewerAspect) {
  const frame = fitTvPolicyViewerFrame({ width, height }, aspect);
  assert.ok(frame, "valid viewport must fit");
  const expected = aspect === "16:9" ? 16 / 9 : 9 / 16;
  assert.ok(Math.abs(frame.width / frame.height - expected) < 1e-10);
  assert.ok(frame.x >= -1e-9 && frame.y >= -1e-9);
  assert.ok(frame.width <= width + 1e-9);
  assert.ok(frame.height <= height + 1e-9);
  assert.ok(Math.abs(frame.x * 2 + frame.width - width) < 1e-9);
  assert.ok(Math.abs(frame.y * 2 + frame.height - height) < 1e-9);
}

for (const [width, height] of [[390, 844], [768, 1024], [1440, 900], [1920, 1080]] as const) {
  test(`PAP-1646 view-only frame 16:9 contained at ${width}x${height}`, () => {
    expectContained(width, height, "16:9");
  });
  test(`PAP-1646 optional portrait frame 9:16 contained at ${width}x${height}`, () => {
    expectContained(width, height, "9:16");
  });
}

test("PAP-1646 rejects invalid geometry rather than emitting unsafe CSS values", () => {
  for (const bad of [NaN, Infinity, -Infinity, -1, 0]) {
    assert.equal(fitTvPolicyViewerFrame({ width: bad, height: 900 }, "16:9"), null);
    assert.equal(fitTvPolicyViewerFrame({ width: 1440, height: bad }, "16:9"), null);
  }
});

test("PAP-1646 landscape is horizontal and portrait is vertical", () => {
  const horizontal = fitTvPolicyViewerFrame({ width: 1920, height: 1080 }, "16:9");
  const vertical = fitTvPolicyViewerFrame({ width: 1920, height: 1080 }, "9:16");
  assert.deepEqual(horizontal, { width: 1920, height: 1080, x: 0, y: 0 });
  assert.ok(vertical);
  assert.ok(vertical.height > vertical.width);
  assert.equal(vertical.height, 1080);
});
