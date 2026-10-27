import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const directory = "public/ho-authority-source/";
const legacy = ["styles.css", "playground.css", "playground-v22.css", "playground-v23.css", "full-detail-v24.css", "full-detail-v25.css"];
const inputs = [...legacy.map(name => readFileSync(directory + name, "utf8")), readFileSync("app/ho/ho-theme.css", "utf8")];
const output = readFileSync(directory + "ho-scoped.css", "utf8");

test("HO staging has a single scoped stylesheet and no parallel injected HO theme", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const hoLayout = readFileSync("app/ho/layout.tsx", "utf8");
  const skeleton = readFileSync("lib/bo-skeleton.ts", "utf8");
  assert.match(layout, /ho \? HO_AUTHORITY_STYLES : BO_AUTHORITY_STYLES/);
  assert.match(skeleton, /HO_AUTHORITY_STYLES = \["ho-scoped\.css"\]/);
  assert.doesNotMatch(hoLayout, /import\s+["'].\/ho-theme\.css["']/);
  assert.match(output, /--ds-primary\s*:/);
  assert.match(output, /--ds-primary-hover\s*:/);
  assert.doesNotMatch(output, /:where\(html\[data-surface="ho"\]\)\s+\[data-surface="ho"\]/);
  assert.match(output, /\[data-surface="ho"\] \.primary-btn/);
});

test("HO consolidated stylesheet preserves declarations, cascade sequence and at-rules exactly", () => {
  const compiled = postcss.parse(output);
  const original = inputs.map(css => postcss.parse(css));
  const serializeDecls = (tree: postcss.Root) => {
    const result: string[] = [];
    tree.walkDecls(decl => { result.push(JSON.stringify([decl.prop, decl.value, decl.important])); });
    return result;
  };
  const serializeAtRules = (tree: postcss.Root) => {
    const result: string[] = [];
    tree.walkAtRules(at => { result.push(JSON.stringify([at.name, at.params])); });
    return result;
  };
  assert.deepEqual(serializeDecls(compiled), original.flatMap(serializeDecls));
  assert.deepEqual(serializeAtRules(compiled), original.flatMap(serializeAtRules));
  assert.equal((output.match(/!important/g) || []).length, inputs.reduce((n,css) => n + (css.match(/!important/g) || []).length,0));
});

test("HO CSS has a zero-specificity host gate on every selector outside keyframes", () => {
  const compiled = postcss.parse(output);
  let rules = 0;
  compiled.walkRules(rule => {
    let keyframes = false;
    for (let parent: { type: string; name?: string; parent?: unknown } | undefined = rule.parent; parent; parent = parent.parent as typeof parent) {
      if(parent.type==="atrule" && /keyframes$/i.test(parent.name ?? "")) {keyframes=true;break;}
    }
    if(keyframes) return;
    rules++;
    for(const selector of rule.selectors) assert.ok(selector.includes('[data-surface="ho"]'), 'unscoped selector: ' + selector);
  });
  assert.ok(rules > 500);
  assert.match(output, /:root:where\(\[data-surface="ho"\]\)/);
  assert.match(output, /:where\(html\[data-surface="ho"\]\) body/);
  assert.doesNotMatch(output, /@import\b/);
});
