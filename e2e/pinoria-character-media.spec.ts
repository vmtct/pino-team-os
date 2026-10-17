import { test, expect } from "@playwright/test";
import { build } from "esbuild";

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LayeredCharacter } from './app/pinoria-tv/layered-character';
const root = createRoot(document.getElementById('root'));
window.renderCharacter = (asset, effect) => root.render(React.createElement(LayeredCharacter, {
  config: {hair: asset, face: asset, outfit: asset},
  effectKey: effect,
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
});
