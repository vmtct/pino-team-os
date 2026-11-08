/* PAP-1604 / Epic PAP-1601 PLT-UI-LOCALE-BO-HO: canonical i5 approved control parity. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const jsx = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
const css = postcss.parse(readFileSync("app/bo/components/registration/PinoLocaleControls.module.css", "utf8"));
const rule = (selector: string) => {
  const match = css.nodes.find(node => node.type === "rule" && node.selector === selector);
  assert.ok(match && match.type === "rule", "Expected scoped component selector " + selector);
  return new Map(match.nodes.filter(node => node.type === "decl").map(decl => [decl.prop, decl.value]));
};

test("PAP-1604 nav locale uses one shared component-owned stylesheet without frozen authority edits", () => {
  assert.match(jsx, /import localeControlStyles from "\.\/PinoLocaleControls\.module\.css"/);
  assert.match(jsx, /className=\{"nav-collapse-actions " \+ localeControlStyles\.actions\}/);
  assert.match(jsx, /className=\{localeControlStyles\.control\} id="pino-nav-toggle-all"/);
  assert.match(jsx, /className=\{localeControlStyles\.control \+ " " \+ localeControlStyles\.language\} id="pino-locale-toggle"/);
  assert.equal((jsx.match(/id="pino-locale-toggle"/g) ?? []).length, 1);
  assert.equal((jsx.match(/id="pino-nav-toggle-all"/g) ?? []).length, 1);
});

test("PAP-1604 controls follow approved i5 31px/4px G3 geometry and DS focus tokens", () => {
  assert.equal(rule(".actions.actions").get("gap"), "4px");
  const control = rule(".actions button.control");
  for (const key of ["width", "min-width"]) assert.equal(control.get(key), "31px");
  for (const key of ["height", "min-height"]) assert.equal(control.get(key), "32px");
  assert.equal(control.get("border-radius"), "7px");
  assert.match(control.get("color") ?? "", /--bo-palette-violet-19/);
  assert.match(rule(".actions button.control:focus-visible").get("outline") ?? "", /--bo-color-focus/);
  assert.equal(rule(".actions button.language").get("font-size"), "11px");
  assert.match(rule(".actions button.language").get("border-color") ?? "", /--bo-color-accent/);
  assert.ok(css.nodes.every(node => node.type !== "rule" || node.selector.startsWith(".actions")), "no unscoped global reset");
});
