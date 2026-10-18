import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

let bundle: Promise<string> | undefined;
function managerBundle() {
  bundle ??= build({
    bundle: true, format: "iife", platform: "browser", jsx: "automatic", write: false,
    define: { "process.env.NODE_ENV": '"test"' },
    stdin: {
      loader: "tsx", resolveDir: process.cwd(), sourcefile: "pinoria-world-harness.tsx",
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { PinoriaWorldManager } from "./app/bo/pinoria-world/PinoriaWorldManager";
        createRoot(document.getElementById("root")!).render(<PinoriaWorldManager />);
      `,
    },
    plugins: [{
      name: "world-builder-harness",
      setup(plugin) {
        plugin.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "test-navigation" }));
        plugin.onLoad({ filter: /.*/, namespace: "test-navigation" }, () => ({
          loader: "js",
          contents: `export const usePathname=()=>location.pathname;
            export const useSearchParams=()=>new URLSearchParams(location.search);
            export const useRouter=()=>({replace:(url)=>history.replaceState(null,"",url),push:(url)=>history.pushState(null,"",url)});`,
        }));
        plugin.onResolve({ filter: /^@\// }, (args) => ({
          path: args.path.slice(2), namespace: "alias-files",
        }));
        plugin.onLoad({ filter: /.*/, namespace: "alias-files" }, async (args) => { const target = resolve(process.cwd(), args.path); const fs = await import("node:fs/promises"); const candidates = [target, target + ".tsx", target + ".ts", target + ".jsx", target + ".js", resolve(target, "index.ts"), resolve(target, "index.tsx")]; for (const file of candidates) { try { const contents = await fs.readFile(file, "utf8"); return { contents, loader: file.endsWith(".tsx") ? "tsx" : file.endsWith(".jsx") ? "jsx" : "ts", resolveDir: resolve(file, "..") }; } catch {} } throw new Error("Cannot resolve " + args.path); });
        plugin.onLoad({ filter: /\.module\.css$/ }, () => ({
          loader: "js", contents: 'export default new Proxy({}, {get: (_, key) => String(key)});',
        }));
      },
    }],
  }).then((result) => result.outputFiles[0]!.text);
  return bundle;
}

test("PAP-735 World Builder opens a canonical World and isolates unsaved draft", async ({ page }) => {
  const world = {
    id: "world-1", key: "region-1", displayName: "Chroma Sea",
    descriptionText: "Original", worldType: "CORE", status: "DRAFT",
    version: 1, thumbnailAssetKey: null, metadata: {}, scenes: [],
  };
  await page.route("http://world.local/**", async (route) => {
    if (route.request().url().includes("/api/bo/pinoria/worlds")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { worlds: [world] } }) });
    } else {
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' });
    }
  });
  await page.goto("http://world.local/bo/pinoria-world");
  await page.addScriptTag({ content: await managerBundle() });
  await expect(page.getByRole("table", { name: "World definitions" })).toBeVisible();
  await page.getByRole("row", { name: /Chroma Sea/ }).click();
  await expect(page.getByRole("button", { name: "Save World" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).last().fill("Chroma Sea Revised");
  await expect(page.getByRole("table", { name: "World definitions" })).toContainText("Chroma Sea");
  await expect(page.getByRole("table", { name: "World definitions" })).not.toContainText("Chroma Sea Revised");
});
