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

test("SET_WEBM suppresses standard layers but preserves Ward effect slots", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  const wardRender = {
    mode: "SET_WEBM" as const,
    webmAssetKey: "ward/set.webm",
    variants: [
      { slot: "OUTFIT" as const, variantId: "variant-outfit", renderMode: "LAYER" as const, assetKey: "ward/OutfitBlue.png", posterAssetKey: null, renderMetadata: {} },
      { slot: "AURA_BACK" as const, variantId: "variant-aura", renderMode: "LAYER" as const, assetKey: "ward/Aura.png", posterAssetKey: null, renderMetadata: { zIndex: 8 } },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config, wardRender }));
  assert.match(html, /data-ward-set-webm/);
  assert.match(html, /set\.webm/);
  assert.match(html, /data-ward-layer="variant-aura"/);
  assert.doesNotMatch(html, /data-ward-layer="variant-outfit"/);
  assert.doesNotMatch(html, /draft\/Body\.png/);
});

test("canonical character layers remain renderable", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  assert.equal(hasRenderableCharacterConfig(config), true);
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config }));
  assert.match(html, /https:\/\/assets\.pinohouse\.art\/draft\/Body\.png/);
});
