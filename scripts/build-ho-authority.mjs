import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const directory = "public/ho-authority-source/";
const themeFile = "app/ho/ho-theme.css";
const manifest = JSON.parse(readFileSync(directory + "manifest.json", "utf8"));
const host = 'html[data-surface="ho"]';
const legacy = [
  "styles.css", "playground.css", "playground-v22.css",
  "playground-v23.css", "full-detail-v24.css", "full-detail-v25.css"
];
const sha = value => createHash("sha256").update(value).digest("hex");

export function scopeHoCss(text) {
  const root = postcss.parse(text);
  root.walkRules(rule => {
    for (let p = rule.parent; p; p = p.parent) {
      if (p.type === "atrule" && /keyframes$/i.test(p.name)) return;
    }
    // Remove the retired HO workspace-switcher selectors from the generated
    // CSS only. Frozen historical inputs remain immutable for audit and rollback.
    const retiredNav = /(?:^|[\s>+~])\.(?:nav-workspace(?:-[\w-]+)?|workspace-angle)(?=$|[\s.:#>+~\[])/;
    const selectors = rule.selectors.filter(selector => !retiredNav.test(selector));
    if (!selectors.length) { rule.remove(); return; }
    rule.selectors = selectors.flatMap(selector => {
      // Theme rules already match html[data-surface="ho"]; never gate twice.
      if (/^\[data-surface=(?:"ho"|'ho')\](?=[\s:.#>+~\[]|$)/.test(selector))
        return [selector.replace(/^\[data-surface='ho'\]/, '[data-surface="ho"]')];
      if (selector === "*") return ['*:where(' + host + ')', ':where(' + host + ') *'];
      if (/^:root(?=[\s:.#>+~\[]|$)/.test(selector))
        return [selector.replace(/^:root/, ':root:where([data-surface="ho"])')];
      if (/^html(?=[\s:.#>+~\[]|$)/.test(selector))
        return [selector.replace(/^html/, 'html:where([data-surface="ho"])')];
      return [':where(' + host + ') ' + selector];
    });
  });
  return root.toString();
}

assert.deepEqual(Object.keys(manifest.files), legacy, "HO frozen input set/order changed");
const css = legacy.map(file => {
  const input = readFileSync(directory + file, "utf8");
  assert.equal(sha(input), manifest.files[file], "Changed frozen HO CSS: " + file);
  return "/* Historical HO input: " + file + " */\n" + scopeHoCss(input);
});
css.push("/* HO theme tokens and scoped compatibility rules */\n" +
  scopeHoCss(readFileSync(themeFile, "utf8")));
css.push("/* Shared TDD opt-in Freeze Column; single HO host-scope output */\n" +
  scopeHoCss(readFileSync('app/components/workspace-renderer/tdd-freeze.css', 'utf8')));
const bundled = "/* HO staging unified CSS. GENERATED; edit the historical sources/theme only. */\n" +
  css.join("\n\n") + "\n";
const dest = directory + "ho-scoped.css";
if (process.argv.includes("--check")) assert.equal(readFileSync(dest, "utf8"), bundled, "HO CSS bundle stale");
else writeFileSync(dest, bundled);
console.log("HO single scoped CSS: source hashes, cascade ordering and deterministic generation PASS");
