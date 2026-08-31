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

test("canonical character layers remain renderable", () => {
  const config = { hair: "draft/Hair.png", face: "draft/Face.png", outfit: "draft/Body.png" };
  assert.equal(hasRenderableCharacterConfig(config), true);
  const html = renderToStaticMarkup(React.createElement(LayeredCharacter, { config }));
  assert.match(html, /https:\/\/assets\.pinohouse\.art\/draft\/Body\.png/);
});
