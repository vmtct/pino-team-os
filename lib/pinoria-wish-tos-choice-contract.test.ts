import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const panel = readFileSync(resolve(root, "app/pinoria/activity-panel.tsx"), "utf8");

test("PNR-WISH TOS choice projects the selected banner", () => {
  assert.match(panel, /const selectedChoice = choices\.find/);
  assert.match(panel, /const wishBanner = selectedChoice\?\.banner/);
  assert.match(panel, /const wishBalance = selectedChoice\?\.energySeedBalance/);
  assert.match(panel, /wish && wishBanner \? ` · \$\{wishBanner\.bearer\.displayName}`/);
  assert.match(panel, /<b>✦ \{wishBalance}<\/b>/);
  assert.match(panel, /aria-label="Chọn banner Wish"/);
  assert.match(panel, /execute\(activity, action, selectedChoice\?\.selectionKey\)/);
  assert.doesNotMatch(panel, /Ch\?a c\?ng h\?\?ng|M\?i|Tr\? l\?i|Theo m\?a|Ch\?n banner Wish/);
});
