import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const css=readFileSync(resolve(root,"app/components/tos-vnext/ops.module.css"),"utf8");
const tokens=readFileSync(resolve(root,"app/components/tos-ds/tokens.css"),"utf8");
const shared=readFileSync(resolve(root,"app/components/tos-ds/primitives.module.css"),"utf8");
const component=readFileSync(resolve(root,"app/components/tos-vnext/OpsV4Body.tsx"),"utf8");

test("PAP-1279: reception content reserves fixed DS nav, spacing, and device safe inset",()=>{
 const content=css.match(/(?:^|\n)\.content\{([^}]*)\}/)?.[1];
 assert.ok(content,"OpsFrame content selector exists");
 assert.match(content,/padding:[^;]*calc\(var\(--tos-nav-height\) \+ var\(--tos-space-4\) \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(component,/className=\{css\.content\}/);
 assert.match(component,/<AppBottomNav/);
});
test("PAP-1279: reservation uses canonical fixed nav height and DS spacing",()=>{
 assert.match(tokens,/--tos-nav-height:\s*76px/);
 assert.match(tokens,/--tos-space-4:\s*16px/);
 assert.match(shared,/\.bottomNav\{position:fixed;bottom:0;/);
 assert.match(shared,/height:var\(--tos-nav-height\)/);
});
