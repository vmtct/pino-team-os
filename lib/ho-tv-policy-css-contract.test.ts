/** PAP-650 / PNR-TV · PAP-1419. Prevent Founder HO from hiding S3 DS controls. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("HO S3 alone restores actionable PINO DS table controls without reopening other HO toolbars", () => {
  const css = readFileSync(new URL("../app/ho/ho-theme.css", import.meta.url), "utf8");
  // Legacy HO suppression remains in force for every other module.
  assert.match(css, /\[data-surface="ho"\] \.toolbar-button, \[data-surface="ho"\] \.view-add \{ display:none!important; \}/);
  // The S3 exception is scoped by both surface and feature, not a global DS override.
  assert.match(css, /\[data-surface="ho"\] \[data-pnr-tv-stage="s3-list"\] \.toolbar :is\(#filter-toggle, #visible-columns, #reset-all\) \{\s*display: inline-flex !important;\s*\}/);
  const override = css.split('[data-pnr-tv-stage="s3-list"]')[1]?.split("}")[0] ?? "";
  assert.doesNotMatch(override, /group-shortcut|undo-v22|view-add|save-view|data-open/);
});
