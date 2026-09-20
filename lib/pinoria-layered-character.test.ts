import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LayeredCharacter,
  hasRenderableCharacterConfig,
  pinoriaAssetUrl,
} from "../app/pinoria-tv/layered-character";

Object.assign(globalThis, { React });

test("invalid character projection fails visibly instead of throwing", () => {
  assert.equal(hasRenderableCharacterConfig({}), false);
  assert.equal(pinoriaAssetUrl(42), null);
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config: {} }));
  assert.match(html, /data-character-state="invalid"/);
  assert.match(html, /Nhân vật chưa sẵn sàng/);
});

test("partial canonical character projections fail visibly", () => {
  const partials: Array<Record<string, string>> = [
    { hair: "draft/Hair.png" },
    { back: "draft/Back.png" },
    { hair: "draft/Hair.png", face: "draft/Face.png" },
    { hair: "draft/Hair.png", outfit: "draft/Body.png" },
    { face: "draft/Face.png", outfit: "draft/Body.png" },
  ];
  for (const config of partials) {
    assert.equal(hasRenderableCharacterConfig(config), false);
    const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config }));
    assert.match(html, /data-character-state="invalid"/);
  }
});

test("blank required canonical layers fail visibly", () => {
  const config = { hair: "draft/Hair.png", face: " ", outfit: "draft/Body.png" };
  assert.equal(hasRenderableCharacterConfig(config), false);
});



test("Ward loadout replaces the canonical slot in rendered character state", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  const wardRender = {
    mode: "LAYERED" as const,
    webmAssetKey: null,
    variants: [{
      slot: "OUTFIT" as const,
      variantId: "variant-outfit",
      renderMode: "LAYER" as const,
      assetKey: "ward/OutfitBlue.png",
      posterAssetKey: null,
      renderMetadata: { zIndex: 22, offsetX: 2, scale: 1.1 },
    }],
  };
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, wardRender }));
  assert.match(html, /data-ward-layer="variant-outfit"/);
  assert.match(html, /ward\/OutfitBlue\.png/);
  assert.doesNotMatch(html, /draft\/Body\.png/);
});


test("WEBM Ward variant renders canonical video media instead of an image layer", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  const wardRender = {
    mode: "LAYERED" as const,
    webmAssetKey: null,
    variants: [{
      slot: "OUTFIT" as const,
      variantId: "variant-video-outfit",
      renderMode: "WEBM" as const,
      assetKey: "ward/OutfitMotion.webm",
      posterAssetKey: "ward/OutfitMotionPoster.png",
      renderMetadata: { zIndex: 22, loop: true },
    }],
  };
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, wardRender }));
  assert.match(html, /data-ward-media="WEBM"/);
  assert.match(html, /data-ward-layer="variant-video-outfit"/);
  assert.match(html, /OutfitMotion\.webm/);
  assert.match(html, /OutfitMotionPoster\.png/);
  assert.match(html, /loop=""/);
  assert.doesNotMatch(html, /draft\/Body\.png/);
});

test("Rainbow effect preserves WEBM Ward media instead of converting it to an image mask", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  const wardRender = {
    mode: "LAYERED" as const,
    webmAssetKey: null,
    variants: [{
      slot: "AURA_BACK" as const,
      variantId: "variant-video-aura",
      renderMode: "WEBM" as const,
      assetKey: "ward/AuraMotion.webm",
      posterAssetKey: "ward/AuraPoster.png",
      renderMetadata: { zIndex: 8, loop: false },
    }],
  };
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, wardRender, effectKey: "RAINBOW" }));
  assert.match(html, /data-ward-layer="variant-video-aura"/);
  assert.match(html, /data-ward-media="WEBM"/);
  assert.match(html, /pino-effect-rainbow-video/);
  assert.doesNotMatch(html, /data-rainbow-source="https:\/\/assets\.pinohouse\.art\/ward\/AuraMotion\.webm"/);
});

test("SET_WEBM suppresses standard layers but preserves Ward effect slots", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  const wardRender = {
    mode: "SET_WEBM" as const,
    webmAssetKey: "ward/set.webm",
    variants: [
      { slot: "OUTFIT" as const, variantId: "variant-outfit", renderMode: "LAYER" as const, assetKey: "ward/OutfitBlue.png", posterAssetKey: null, renderMetadata: {} },
      { slot: "AURA_BACK" as const, variantId: "variant-aura", renderMode: "WEBM" as const, assetKey: "ward/Aura.webm", posterAssetKey: "ward/AuraPoster.png", renderMetadata: { zIndex: 8, loop: true } },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, wardRender }));
  assert.match(html, /data-ward-set-webm/);
  assert.match(html, /set\.webm/);
  assert.match(html, /data-ward-layer="variant-aura"/);
  assert.match(html, /data-ward-media="WEBM"/);
  assert.match(html, /Aura\.webm/);
  assert.doesNotMatch(html, /data-ward-layer="variant-outfit"/);
  assert.doesNotMatch(html, /draft\/Body\.png/);
});

test("canonical character layers remain renderable", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  assert.equal(hasRenderableCharacterConfig(config), true);
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config }));
  assert.match(html, /https:\/\/assets\.pinohouse\.art\/draft\/Body\.png/);
});
