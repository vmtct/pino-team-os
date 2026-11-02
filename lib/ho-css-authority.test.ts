import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const directory = "public/ho-authority-source/";
const legacy = ["styles.css", "playground.css", "playground-v22.css", "playground-v23.css", "full-detail-v24.css", "full-detail-v25.css"];
const inputs = [...legacy.map(name => readFileSync(directory + name, "utf8")), readFileSync("app/ho/ho-theme.css", "utf8"), readFileSync("app/components/workspace-renderer/tdd-freeze.css", "utf8")];
const output = readFileSync(directory + "ho-scoped.css", "utf8");
const retiredNav = /(?:^|[\s>+~])\.(?:nav-workspace(?:-[\w-]+)?|workspace-angle)(?=$|[\s.:#>+~\[])/;

test("HO Staff login never fetches private CSS, while application pages still use it", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(middleware, /forwarded\.delete\("x-pino-ho-auth-page"\)/);
  assert.match(middleware, /\["\/staff-login", "\/staff-password\/change"\]/);
  assert.match(middleware, /forwarded\.set\("x-pino-ho-auth-page", "1"\)/);
  assert.match(layout, /const hoAuthPage = ho && incoming\.get\("x-pino-ho-auth-page"\) === "1"/);
  assert.match(layout, /: hoAuthPage \? \[\] : \["\/team-legacy-global\.css"\]/);
  assert.match(layout, /ho \? HO_AUTHORITY_STYLES : BO_AUTHORITY_STYLES/);
});

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

test("HO CSS preserves every live declaration and at-rule while removing retired workspace nav", () => {
  const compiled = postcss.parse(output);
  const original = inputs.map(css => postcss.parse(css));
  const serializeDecls = (tree: postcss.Root, removeDead = false) => {
    const result: string[] = [];
    tree.walkDecls(decl => {
      if (removeDead && decl.parent?.type === "rule" && decl.parent.selectors.every(selector => retiredNav.test(selector))) return;
      result.push(JSON.stringify([decl.prop, decl.value, decl.important]));
    });
    return result;
  };
  const serializeAtRules = (tree: postcss.Root) => {
    const result: string[] = [];
    tree.walkAtRules(at => { result.push(JSON.stringify([at.name, at.params])); });
    return result;
  };
  assert.deepEqual(serializeDecls(compiled), original.flatMap(root => serializeDecls(root, true)));
  assert.deepEqual(serializeAtRules(compiled), original.flatMap(serializeAtRules));
  let liveImportant = 0; for (const root of original) root.walkDecls(decl => {
    if (decl.important && !(decl.parent?.type === "rule" && decl.parent.selectors.every(selector => retiredNav.test(selector)))) liveImportant++;
  });
  let outputImportant = 0; compiled.walkDecls(decl => { if (decl.important) outputImportant++; });
  assert.equal(outputImportant, liveImportant);
  assert.doesNotMatch(output, /\.nav-workspace(?:[-.\s:#>+~\[]|$)|\.workspace-angle(?:[-.\s:#>+~\[]|$)/);
});

test("HO sidebar uses approved logo, removes workspace nav, and leaves BO switcher", () => {
  const jsx = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
  const theme = readFileSync("app/ho/ho-theme.css", "utf8");
  assert.match(jsx, /src="https:\/\/assets\.pinohouse\.art\/core\/Pino%20Logo\.png"/);
  assert.match(jsx, /<BoCenterSwitcher \/>/);
  assert.doesNotMatch(jsx, /nav-workspace|workspace-angle/);
  assert.match(theme, /\.ho-brand-logo/);
  const logoRule = postcss.parse(theme).nodes.find(node => node.type === "rule" && node.selector === '[data-surface="ho"] .ho-brand-logo');
  assert.ok(logoRule && logoRule.type === "rule", "HO brand logo CSS rule must exist");
  const logoBackground = logoRule.nodes.filter(node => node.type === "decl" && /^(?:background|background-color|background-image)$/.test(node.prop));
  assert.equal(logoBackground.length, 0, "HO logo must not paint its own background");
  assert.doesNotMatch(theme, /\.brand-mark|\.nav-workspace/);
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
