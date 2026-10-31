import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

let renderPromise: Promise<(extras?: Record<string, unknown>) => string> | null = null;
function actualGridMarkup() {
  renderPromise ??= (async () => {
    const root = process.cwd();
    const result = await build({
      bundle: true, format: "cjs", platform: "node", write: false,
      alias: { "@": root },
      external: ["react", "react-dom", "react-dom/server", "next/*"],
      stdin: {
        loader: "tsx", resolveDir: root, sourcefile: "pap1129-toolbar-actual-renderer.tsx",
        contents: `
          import React from "react";
          import { renderToStaticMarkup } from "react-dom/server";
          import { BoDataGrid } from "./app/bo/components/data-grid/BoDataGrid";
          export function render(extras = {}) {
            const row = { id: "rate-row-001", amount: "50.000" };
            const props = {
              rows: [row],
              columns: [
                { key: "date", header: "Ngày hiệu lực", render: () => "01/11/2026" },
                { key: "until", header: "Ngày kết thúc", render: () => "—" },
                { key: "amount", header: "Mức lương", render: r => r.amount },
                { key: "reason", header: "Lý do", render: () => "Phê duyệt" },
              ],
              rowKey: r => r.id,
              caption: "Lịch sử Rate",
              ...extras,
            };
            return renderToStaticMarkup(React.createElement(BoDataGrid, props));
          }
        `,
      },
      plugins: [
        {
          name: "pap1129-alias-css",
          setup(context) {
            context.onLoad({ filter: /\.module\.css$/ }, () => ({
              loader: "js",
              contents: 'export default new Proxy({}, {get: (_, key) => String(key)});',
            }));
          },
        },
      ],
    });
    const file = resolve(root, "node_modules/.cache/pap1129-bo-toolbar.cjs");
    mkdirSync(resolve(root, "node_modules/.cache"), { recursive: true });
    writeFileSync(file, result.outputFiles[0]!.text, "utf8");
    return createRequire(import.meta.url)(file).render as (extras?: Record<string, unknown>) => string;
  })();
  return renderPromise;
}

test("PAP-1129 default keeps existing toolbar and canonical four-column history", async () => {
  const render = await actualGridMarkup();
  const html = render();
  assert.match(html, /class="surface"/);
  assert.match(html, /class="toolbar"/);
  assert.match(html, /<caption[^>]*>Lịch sử Rate<\/caption>/);
  for (const header of ["Ngày hiệu lực", "Ngày kết thúc", "Mức lương", "Lý do"]) assert.ok(html.includes(header), header);
  assert.match(html, /50\.000/);
});

test("PAP-1129 explicit showToolbar=false removes toolbar DOM but keeps table and rows", async () => {
  const render = await actualGridMarkup();
  const withToolbar = render({ showToolbar: true });
  const compact = render({ showToolbar: false });
  assert.match(withToolbar, /class="toolbar"/);
  assert.doesNotMatch(compact, /class="toolbar"/);
  assert.match(compact, /<caption[^>]*>Lịch sử Rate<\/caption>/);
  assert.match(compact, /50\.000/);
  assert.match(compact, /Ngày hiệu lực/);
  assert.match(compact, /<thead>/);
  assert.match(compact, /<tbody>/);
});

test("PAP-1129 opt-out preserves loading, denied and empty-state semantics", async () => {
  const render = await actualGridMarkup();
  for (const state of ["loading", "permission", "error", "ready"] as const) {
    const html = render({ showToolbar: false, rows: [], state });
    assert.doesNotMatch(html, /class="toolbar"/);
    assert.match(html, /<caption[^>]*>Lịch sử Rate<\/caption>/);
    assert.match(html, /<thead>/);
    if (state === "permission" || state === "error") assert.match(html, /role="alert"/);
    if (state === "loading") assert.match(html, /skeletonRow/);
  }
});
