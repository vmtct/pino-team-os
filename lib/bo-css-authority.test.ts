import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postcss from "postcss";
import { BO_AUTHORITY_STYLES, HO_AUTHORITY_STYLES, serveBoSkeleton, type BoSkeletonEnv } from "./bo-skeleton";
const base = "public/bo-authority-source/", raw = readFileSync(base + "styles.css", "utf8"), scoped = readFileSync(base + "bo-scoped.css", "utf8");
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
test("PAP-1022 exact canonical authority and one stylesheet are pinned", () => {
  assert.equal(digest(raw), "f09418c17d502e3f4c9b18fcc2e51031805ab647cdf58c0e905adb16a9f69fda");
  assert.equal(digest(readFileSync(base + "CSS_AUTHORITY.json")), "344e0df46a6f2a3b520f61551bc23739d610b1e1f0ddac91f9835ca6867aee20");
  assert.deepEqual(BO_AUTHORITY_STYLES, ["styles.css"]);
  assert.equal([...raw.matchAll(/!important/g)].length, 1);
  assert.match(raw, /\[hidden\]/);
});
test("BO scope preserves every rule declaration and at-rule in original order", () => {
  const original = postcss.parse(raw), isolated = postcss.parse(scoped);
  const declarations = (root: postcss.Root) => { const result: string[] = []; root.walkDecls(d => { result.push(JSON.stringify([d.prop, d.value, d.important, d.parent?.type === "atrule" ? d.parent.name : "rule"])); }); return result; };
  assert.deepEqual(declarations(isolated), declarations(original));
  const rules: string[] = []; original.walkRules(rule => { rules.push(rule.selector); });
  let index = 0;
  isolated.walkRules(rule => {
    const selectors = postcss.list.comma(rules[index++]);
    const expected = selectors.flatMap(selector => selector === "*" ? ['*:where(html[data-bo-ui-authority="v25"])', ':where(html[data-bo-ui-authority="v25"]) *'] : selector.startsWith(":root") ? [selector.replace(":root", ':root:where([data-bo-ui-authority="v25"])')] : selector === "html" ? ['html:where([data-bo-ui-authority="v25"])'] : [':where(html[data-bo-ui-authority="v25"]) ' + selector]);
    assert.deepEqual(rule.selectors, expected);
    for (const selector of rule.selectors) assert.match(selector, /data-bo-ui-authority="v25"/);
  });
  assert.equal(index, rules.length);
  const atRules = (root: postcss.Root) => { const result: string[] = []; root.walkAtRules(a => { result.push(a.name + " " + a.params); }); return result; };
  assert.deepEqual(atRules(isolated), atRules(original));
});
test("canonical property labels use responsive tracks and one aligned icon gutter", () => {
  const css = postcss.parse(raw);
  function widthAt(width: number) { let value; css.walkRules(rule => { if (rule.selector !== ".property-row") return; for (let p = rule.parent; p && p.type !== "root"; p = p.parent) { if (p.type === "atrule" && p.name === "media") { const max = p.params.match(/max-width:\s*(\d+)px/); if (max && width > Number(max[1])) return; } } rule.walkDecls("grid-template-columns", d => { value = d.value; }); }); return value; }
  assert.deepEqual([390,450,451,760,761,768,1440].map(widthAt), ["102px minmax(0,1fr)","102px minmax(0,1fr)","108px minmax(0,1fr)","108px minmax(0,1fr)","130px minmax(0,1fr)","130px minmax(0,1fr)","130px minmax(0,1fr)"]);
  assert.match(raw, /--bo-property-label-icon-width:\s*18px/); assert.match(raw, /grid-template-columns:\s*var\(--bo-property-label-icon-width\) minmax\(0,\s*1fr\)/);
});
test("HO retains the frozen six stylesheet bytes and BO root scope is opt-in", () => {
  const manifest = JSON.parse(readFileSync("public/ho-authority-source/manifest.json", "utf8"));
  assert.equal(manifest.files["styles.css"], "5b7af5a0ec8a7d92e1778f3de8ad82248aa7539b220c7dc6dd90ef88a26a4425");
  assert.deepEqual(Object.keys(manifest.files), ["styles.css", "playground.css", "playground-v22.css", "playground-v23.css", "full-detail-v24.css", "full-detail-v25.css"]);
  assert.deepEqual(HO_AUTHORITY_STYLES, ["ho-scoped.css"]);
  for (const [file, sha] of Object.entries(manifest.files)) assert.equal(digest(readFileSync("public/ho-authority-source/" + file)), sha);
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /data-bo-ui-authority=\{bo \? "v25" : undefined\}/);
  assert.match(layout, /ho \? HO_AUTHORITY_STYLES : BO_AUTHORITY_STYLES/);
  assert.match(layout, /\["\/team-legacy-global.css"\]/);
});
test("HO authenticated CSS resolves its compatibility asset; BO rejects retired cascade", async () => {
  const paths: string[] = [];
  const env: BoSkeletonEnv = { APP_ENV: "staging", BO_UI_ONLY: "enabled", HO_PILOT_FOUNDER_USER_IDS: "u", PINO_BO_CORE: { async executeWithStaffPassword() { return { status: 200, requestId: "fixture", body: { data: { userId: "u", email: "fixture@example.test", surface: "BO", entitled: true } } }; } }, ASSETS: { async fetch(request) { paths.push(new URL(request.url).pathname); return new Response("fixture"); } } };
  const request = new Request("https://ho.staging.pinohouse.art/bo-skeleton/ho-scoped.css", { headers: { host: "ho.staging.pinohouse.art", cookie: "pino_staff_password_session=fixture" } });
  assert.equal((await serveBoSkeleton(request, env, "ho-scoped.css")).status, 200);
  assert.equal(paths.at(-1), "/ho-authority-source/ho-scoped.css");
  for (const oldFile of Object.keys(JSON.parse(readFileSync("public/ho-authority-source/manifest.json", "utf8")).files)) {
    assert.equal((await serveBoSkeleton(new Request("https://ho.staging.pinohouse.art/bo-skeleton/" + oldFile), env, oldFile)).status, 404);
  }
  assert.equal((await serveBoSkeleton(new Request("https://bo.staging.pinohouse.art/bo-skeleton/ho-scoped.css"), env, "ho-scoped.css")).status, 404);
});
test("center switcher is presentation-only with canonical logo and accessible dismissal", () => {
  const component = readFileSync("app/bo/components/registration/BoCenterSwitcher.tsx", "utf8");
  assert.match(component, /https:\/\/assets.pinohouse.art\/core\/Pino%20Logo%20White.png/);
  for (const contract of ["aria-expanded", "aria-controls", "Escape", "pointerdown", "onBlur", "trigger.current?.focus()", "disabled"]) assert.ok(component.includes(contract), contract);
  assert.doesNotMatch(component, /fetch\(|localStorage|sessionStorage|window.location|Trung tâm 02|Trung tâm 03/);
  const workspace = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
  assert.match(workspace, /\{ho \? <>.*className="brand".*<\/> : <BoCenterSwitcher \/>\}/);
  const table = readFileSync("app/bo/components/registration/BoDataTable.tsx", "utf8");
  assert.match(table, /"--bo-column-width": f.w \+ "px"/);
  assert.match(table, /legacyStyles \? \{ width: f.w, minWidth: f.w \}/);
});
