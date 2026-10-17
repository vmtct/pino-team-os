import { test, expect } from "@playwright/test";
import { build } from "esbuild";

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LayeredCharacter } from './app/pinoria-tv/layered-character';
const root = createRoot(document.getElementById('root'));
window.renderCharacter = (asset, effect, wardRender) => root.render(React.createElement(LayeredCharacter, {
  config: {hair: asset, face: asset, outfit: asset},
  effectKey: effect,
  wardRender,
}));
`;

test.use({ launchOptions: { channel: "chrome" }, video: "off" });

test("Rainbow removes broken masks and retries when canonical asset changes", async ({ page }) => {
  const bundle = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "pinoria-character-browser.tsx", loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  });
  await page.route("**/broken-a.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.route("**/broken-b.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.evaluate(() => (window as unknown as {renderCharacter: (url: string, effect: string) => void}).renderCharacter("http://localhost/broken-a.png", "RAINBOW"));
  await expect(page.locator(".pino-effect-rainbow-layer")).toHaveCount(0);
  await page.evaluate(() => (window as unknown as {renderCharacter: (url: string, effect: string) => void}).renderCharacter("http://localhost/broken-b.png", "RAINBOW"));
  await expect(page.locator(".pino-effect-rainbow-layer")).toHaveCount(0);
  await expect(page.locator("#root img")).toHaveCount(0);
  await page.route("**/recovered.png", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==", "base64") }));
  await page.evaluate(() => (window as unknown as {renderCharacter: (url: string, effect: string) => void}).renderCharacter("http://localhost/recovered.png", "RAINBOW"));
  await expect(page.locator(".pino-effect-rainbow-layer")).toHaveCount(3);
});

test("Ward WEBM failure hides video and restores layered fallback", async ({ page }) => {
  const bundle = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "pinoria-character-browser.tsx", loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  });
  await page.route("**/bad-ward.webm", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.route("**/base.png", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==", "base64") }));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  const wardRender = { mode: "SET_WEBM", webmAssetKey: "http://localhost/bad-ward.webm", variants: [] };
  await page.evaluate((ward) => (window as unknown as {renderCharacter: (url: string, effect: string | null, ward: unknown) => void}).renderCharacter("http://localhost/base.png", null, ward), wardRender);
  await expect(page.locator('[data-ward-render-mode="LAYERED"]')).toHaveCount(1);
  await expect(page.locator('[data-ward-set-webm]')).toHaveCount(0);
  await expect(page.locator('#root img')).toHaveCount(3);
});

test("Companion ritual hides broken species asset and recovers for a new asset", async ({ page }) => {
  const ritualEntry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CompanionRitualScene } from './app/pinoria-tv/companion-ritual-scene';
const root = createRoot(document.getElementById('root'));
window.renderRitual = (asset) => root.render(React.createElement(CompanionRitualScene, {
 ritual: {subject: {displayName:'Piner',character:{config:{hair:'http://localhost/base.png',face:'http://localhost/base.png',outfit:'http://localhost/base.png'}}},companion:{id:'pet',displayName:'Mori',assetKey:asset,sigilAssetKey:null,fromLevel:1,toLevel:2},experience:{profileKey:'x'}}
}));
`;
  const bundle = await build({ stdin: { contents: ritualEntry, resolveDir: process.cwd(), sourcefile: "pinoria-ritual-browser.tsx", loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", loader: { ".module.css": "empty" } });
  await page.route("**/broken-pet.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.route("**/good-pet.png", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==", "base64") }));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.evaluate(() => (window as unknown as {renderRitual:(url:string)=>void}).renderRitual('http://localhost/broken-pet.png'));
  await expect(page.locator('section div').filter({hasText:'✦'}).first()).toBeVisible();
  await page.evaluate(() => (window as unknown as {renderRitual:(url:string)=>void}).renderRitual('http://localhost/good-pet.png'));
  await expect(page.locator('img[src="http://localhost/good-pet.png"]')).toHaveCount(1);
});

test("House keeps other actors visible during missing assets and late materialization", async ({ page }) => {
  const houseEntry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientHouseRuntime } from './app/pinoria-tv/ambient-house-runtime';
const root = createRoot(document.getElementById('root'));
window.renderHouse = (ready) => root.render(React.createElement(AmbientHouseRuntime, {actors: [
 {id:'learner-a', actorType:'LEARNER', name:'A', config: ready ? {hair:'http://localhost/ready.png',face:'http://localhost/ready.png',outfit:'http://localhost/ready.png'} : {}},
 {id:'learner-b', actorType:'LEARNER', name:'B', config: {hair:'http://localhost/ready.png',face:'http://localhost/ready.png',outfit:'http://localhost/ready.png'}}
]}));
`;
  const bundle = await build({ stdin: { contents: houseEntry, resolveDir: process.cwd(), sourcefile: "pinoria-house-browser.tsx", loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", loader: { ".module.css": "empty" } });
  await page.route("**/ready.png", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aQAAAABJRU5ErkJggg==", "base64") }));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.evaluate(() => (window as unknown as {renderHouse:(ready:boolean)=>void}).renderHouse(false));
  await expect(page.locator('[data-ambient-runtime-self="learner-a"] [data-character-state="fallback"]')).toHaveCount(1);
  await expect(page.locator('[data-ambient-runtime-self="learner-b"] img[src="http://localhost/ready.png"]')).toHaveCount(3);
  await page.evaluate(() => (window as unknown as {renderHouse:(ready:boolean)=>void}).renderHouse(true));
  await expect(page.locator('[data-ambient-runtime-self="learner-a"] img[src="http://localhost/ready.png"]')).toHaveCount(3);
  await expect(page.locator('[data-ambient-runtime-character]')).toHaveCount(2);
});
