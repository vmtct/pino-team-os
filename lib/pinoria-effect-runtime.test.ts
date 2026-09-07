import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolvePinoriaEffectPresentation } from "./pinoria-effect-presentation";
import { LayeredCharacter } from "../app/pinoria-tv/layered-character";
import { createAmbientAgents, stepAmbientAgents, type AmbientMotionGraph } from "../app/pinoria-tv/ambient-house-motion";

Object.assign(globalThis, { React });

const config = {
  hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png", headwear: "draft/Hat.png",
};

test("Effect presentation is code-defined and unknown keys fail closed", () => {
  assert.deepEqual(resolvePinoriaEffectPresentation("GIANT"), { key: "GIANT", houseScale: 2, speedMultiplier: 0.55, spectral: false, floating: false, rainbowSilhouette: false });
  assert.equal(resolvePinoriaEffectPresentation("UNKNOWN"), null);
  assert.equal(resolvePinoriaEffectPresentation(null), null);
});

test("Rainbow uses exact current layers as chroma masks and suppresses original image rendering", () => {
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, effectKey: "RAINBOW", effectSurface: "FULL_AVATAR" }));
  assert.match(html, /data-pinoria-effect="RAINBOW"/);
  assert.match(html, /data-rainbow-layer-count="4"/);
  assert.match(html, /data-rainbow-source="https:\/\/assets\.pinohouse\.art\/draft\/Hat\.png"/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /pino-rainbow-shift/);
  assert.match(html, /prefers-reduced-motion/);
});

test("Giant and Tiny alter full-avatar framing without changing current layer identity", () => {
  const giant = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, effectKey: "GIANT", effectSurface: "FULL_AVATAR" }));
  const tiny = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, effectKey: "TINY", effectSurface: "FULL_AVATAR" }));
  assert.match(giant, /data-pinoria-effect="GIANT"/);
  assert.match(giant, /scale\(1\.14\)/);
  assert.match(tiny, /data-pinoria-effect="TINY"/);
  assert.match(tiny, /scale\(0\.72\)/);
  assert.match(giant, /draft\/Hat\.png/);
  assert.match(tiny, /draft\/Hat\.png/);
});

test("Ghost keeps current layers while applying spectral and floating presentation", () => {
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, effectKey: "GHOST", effectSurface: "HOUSE_MINI" }));
  assert.match(html, /data-pinoria-effect="GHOST"/);
  assert.match(html, /pino-effect-ghost-frame/);
  assert.match(html, /opacity\(\.62\)/);
  assert.match(html, /draft\/Body\.png/);
});

test("Unknown Effect renders the ordinary current character", () => {
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, effectKey: "NOT_SUPPORTED" }));
  assert.doesNotMatch(html, /data-pinoria-effect/);
  assert.match(html, /<img/);
  assert.match(html, /draft\/Body\.png/);
});

const speedGraph: AmbientMotionGraph = {
  canvas: { width: 1000, height: 600 },
  miniCharacter: { width: 100, height: 100 },
  horizontalLanes: [{ id: "lane", y: 300, x1: 100, x2: 900, midLayer: "front" }],
};

test("Giant and Tiny speed multipliers alter House movement while preserving canonical bounds", () => {
  const original = createAmbientAgents(["effect-probe"], speedGraph)[0]!;
  const base = { ...original, motionState: "walk" as const, activityRemainingMs: 999_999, direction: 1 as const, x: 500 };
  const normal = stepAmbientAgents([base], speedGraph, 80)[0]!;
  const giant = stepAmbientAgents([base], speedGraph, 80, { speedMultipliers: new Map([[base.id, 0.55]]) })[0]!;
  const tiny = stepAmbientAgents([base], speedGraph, 80, { speedMultipliers: new Map([[base.id, 1.45]]) })[0]!;
  assert.ok(giant.x > base.x && giant.x < normal.x);
  assert.ok(tiny.x > normal.x);
  assert.ok(giant.x >= 100 && tiny.x <= 900);
});

test("Ambient House wires Effect identity into scale, renderer and speed without a second actor authority", () => {
  const source = readFileSync(join(process.cwd(), "app/pinoria-tv/ambient-house-runtime.tsx"), "utf8");
  assert.match(source, /effectKey\?: string \| null/);
  assert.match(source, /effect\?\.houseScale/);
  assert.match(source, /speedMultipliers/);
  assert.match(source, /effectSurface="HOUSE_MINI"/);
  assert.match(source, /data-pinoria-effect/);
  assert.doesNotMatch(source, /effectAgent|effectPath|EffectPresence/);
});
